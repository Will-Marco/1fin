import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as admin from 'firebase-admin';

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
        `Firebase init failed — push notifications disabled: ${error.message}`,
      );
    }
  }

  async sendPush(payload: PushNotificationPayload): Promise<boolean> {
    if (!this.app) return false;

    const tokens = await this.getActiveTokens([payload.userId]);
    if (tokens.length === 0) {
      this.logger.debug(`No active FCM tokens for user ${payload.userId}`);
      return false;
    }

    return this.sendToTokens(tokens, payload.title, payload.body, payload.data);
  }

  async sendBulkPush(payload: BulkPushPayload): Promise<boolean> {
    if (!this.app || payload.userIds.length === 0) return false;

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
          stringData[key] = String(value);
        }
      }

      const response = await admin.messaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: stringData,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      // Muvaffaqiyatsiz (invalid) tokenlarni deactivate qilish
      const failedTokens: string[] = [];
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const code = res.error?.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
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

      this.logger.log(
        `FCM sent: ${response.successCount} success, ${response.failureCount} failed`,
      );
      return response.successCount > 0;
    } catch (error) {
      this.logger.error(`FCM send failed: ${error.message}`);
      return false;
    }
  }

  private async getActiveTokens(userIds: string[]): Promise<string[]> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { fcmToken: true },
    });
    return tokens.map((t) => t.fcmToken);
  }
}
