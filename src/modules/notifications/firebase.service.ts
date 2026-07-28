import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as admin from 'firebase-admin';

/**
 * Tokenni butunlay o'lik deb hisoblaydigan FCM xato kodlari — bularni
 * deactivate qilamiz, chunki qayta urinish hech qachon yordam bermaydi.
 *
 * ATAYLAB kiritilmagan:
 *   - messaging/third-party-auth-error: bu TOKEN muammosi emas, Firebase
 *     konsolidagi APNs (iOS push) credential yo'q/muddati o'tgan degani.
 *     Deactivate qilsak, APNs tuzatilgach ham userlar push olmay qoladi.
 *     Yechim — Firebase Console → Cloud Messaging → APNs key (.p8) yuklash.
 *   - messaging/internal-error, messaging/server-unavailable, messaging/
 *     unavailable: vaqtinchalik xatolar — token yaroqli, keyinroq ishlaydi.
 */
const PERMANENT_TOKEN_ERRORS = new Set<string>([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  // "not a valid FCM registration token" — buzuq token. Multicast'da faqat
  // ba'zi tokenlar shu xato bersa (hammasi emas), bu payload emas, token
  // muammosi ekanini bildiradi.
  'messaging/invalid-argument',
]);

interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface BulkPushPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials not configured — push notifications disabled',
      );
      return;
    }

    try {
      if (admin.apps.length === 0) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        this.app = admin.apps[0]!;
      }
      this.logger.log('Firebase Admin initialized');
    } catch (error) {
      this.logger.error(
        `Firebase init failed — push notifications disabled: ${error.message}. ` +
          'If this is a "DECODER routines::unsupported" error, the private key is ' +
          'malformed — prefer setting FIREBASE_PRIVATE_KEY_BASE64 (base64 of the PEM).',
      );
    }
  }

  async sendPush(payload: PushNotificationPayload): Promise<boolean> {
    if (!this.app) {
      this.logger.warn(
        `Push skipped — Firebase not initialized (user ${payload.userId})`,
      );
      return false;
    }

    const tokens = await this.getActiveTokens([payload.userId]);
    if (tokens.length === 0) {
      this.logger.debug(`No active FCM tokens for user ${payload.userId}`);
      return false;
    }

    return this.sendToTokens(tokens, payload.title, payload.body, payload.data);
  }

  async sendBulkPush(payload: BulkPushPayload): Promise<boolean> {
    if (!this.app) {
      this.logger.warn(
        `Bulk push skipped — Firebase not initialized (${payload.userIds.length} users)`,
      );
      return false;
    }
    if (payload.userIds.length === 0) return false;

    const tokens = await this.getActiveTokens(payload.userIds);
    if (tokens.length === 0) {
      this.logger.debug(
        `No active FCM tokens for ${payload.userIds.length} users`,
      );
      return false;
    }

    return this.sendToTokens(tokens, payload.title, payload.body, payload.data);
  }

  private async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<boolean> {
    try {
      const stringData: Record<string, string> = {};
      if (data) {
        for (const [key, value] of Object.entries(data)) {
          if (value === undefined || value === null) continue;
          stringData[key] = String(value);
        }
      }

      // title/body ni data ga ham qo'shamiz: ba'zi clientlar (ayniqsa
      // chat ilovalardagi background handler) notificationni `data` dan
      // quradi. Aks holda banner bo'sh chiqadi. notification blokidan
      // ustun bo'lib ketmasligi uchun faqat data da bo'lmasa qo'shamiz.
      stringData.title = stringData.title ?? title;
      stringData.body = stringData.body ?? body;

      const response = await admin.messaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: stringData,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      // Muvaffaqiyatsiz (invalid) tokenlarni deactivate qilish
      const failedTokens: string[] = [];
      const errorCounts: Record<string, number> = {};
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const code = res.error?.code ?? 'unknown';
          errorCounts[code] = (errorCounts[code] ?? 0) + 1;

          // Token oxiridan 12 belgi — logdan tokenni ajratish uchun yetarli,
          // to'liq tokenni logga yozmaymiz.
          this.logger.warn(
            `FCM token failed [${code}] ...${tokens[idx].slice(-12)}: ${res.error?.message}`,
          );

          if (PERMANENT_TOKEN_ERRORS.has(code)) {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        await this.prisma.deviceToken.updateMany({
          where: { fcmToken: { in: failedTokens } },
          data: { isActive: false },
        });
      }

      // failed va deactivated orasidagi farq = cleanup tutmagan xatolar.
      // Agar bu farq har safar takrorlansa, o'lik tokenlar to'planib boradi.
      const codeSummary = Object.entries(errorCounts)
        .map(([code, count]) => `${code}=${count}`)
        .join(', ');

      this.logger.log(
        `FCM sent: ${response.successCount} success, ${response.failureCount} failed` +
          (codeSummary ? ` [${codeSummary}]` : '') +
          `, ${failedTokens.length} deactivated`,
      );
      return response.successCount > 0;
    } catch (error) {
      this.logger.error(`FCM send failed: ${error.message}`);
      return false;
    }
  }

  private async getActiveTokens(userIds: string[]): Promise<string[]> {
    const tokens = await this.prisma.deviceToken.findMany({
      // notificationsEnabled — CLIENT_FOUNDER o'chira oladigan flag.
      // O'chirilgan bo'lsa push yubormaymiz (in-app notification qoladi).
      where: {
        userId: { in: userIds },
        isActive: true,
        user: { notificationsEnabled: true },
      },
      select: { fcmToken: true },
    });
    return tokens.map((t) => t.fcmToken);
  }
}
