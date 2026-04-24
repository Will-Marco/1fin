import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

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
export class OneSignalService {
  private readonly logger = new Logger(OneSignalService.name);
  private readonly appId: string;
  private readonly apiKey: string;
  private readonly apiUrl = 'https://onesignal.com/api/v1';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.appId = this.configService.get<string>('onesignal.appId') || '';
    this.apiKey = this.configService.get<string>('onesignal.apiKey') || '';
  }

  async sendPush(payload: PushNotificationPayload): Promise<boolean> {
    if (!this.appId || !this.apiKey) {
      this.logger.warn('OneSignal credentials not configured');
      return false;
    }

    const playerIds = await this.getActivePlayerIds([payload.userId]);
    if (playerIds.length === 0) {
      this.logger.debug(
        `No active device tokens for user ${payload.userId} — skipping push`,
      );
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify({
          app_id: this.appId,
          include_player_ids: playerIds,
          headings: { en: payload.title },
          contents: { en: payload.body },
          data: payload.data || {},
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`OneSignal error: ${error}`);
        return false;
      }

      const result = await response.json();
      this.logger.log(`Push sent to user ${payload.userId}: ${result.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push: ${error.message}`);
      return false;
    }
  }

  async sendBulkPush(payload: BulkPushPayload): Promise<boolean> {
    if (!this.appId || !this.apiKey) {
      this.logger.warn('OneSignal credentials not configured');
      return false;
    }

    if (payload.userIds.length === 0) {
      return true;
    }

    const playerIds = await this.getActivePlayerIds(payload.userIds);
    if (playerIds.length === 0) {
      this.logger.debug(
        `No active device tokens for ${payload.userIds.length} users — skipping bulk push`,
      );
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify({
          app_id: this.appId,
          include_player_ids: playerIds,
          headings: { en: payload.title },
          contents: { en: payload.body },
          data: payload.data || {},
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`OneSignal bulk error: ${error}`);
        return false;
      }

      const result = await response.json();
      this.logger.log(
        `Bulk push sent to ${playerIds.length} devices (${payload.userIds.length} users): ${result.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to send bulk push: ${error.message}`);
      return false;
    }
  }

  private async getActivePlayerIds(userIds: string[]): Promise<string[]> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { playerId: true },
    });
    return tokens.map((t) => t.playerId);
  }

  async sendToSegment(
    segment: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<boolean> {
    if (!this.appId || !this.apiKey) {
      this.logger.warn('OneSignal credentials not configured');
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify({
          app_id: this.appId,
          included_segments: [segment],
          headings: { en: title },
          contents: { en: body },
          data: data || {},
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`OneSignal segment error: ${error}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to send to segment: ${error.message}`);
      return false;
    }
  }
}
