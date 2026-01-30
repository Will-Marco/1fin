import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq.service';
import { QUEUES } from '../constants';
import { PrismaService } from '../../database/prisma.service';
import { NotificationType } from '../producers';
import { OneSignalService } from '../../modules/notifications/onesignal.service';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private rabbitMQService: RabbitMQService,
    private prisma: PrismaService,
    @Optional() private oneSignalService?: OneSignalService,
  ) {}

  async onModuleInit() {
    // Wait a bit for RabbitMQ to connect
    setTimeout(() => this.startConsuming(), 2000);
  }

  private async startConsuming() {
    if (!this.rabbitMQService.isReady()) {
      this.logger.warn('RabbitMQ not ready, notification consumers not started');
      return;
    }

    await this.consumeNotifications();
    await this.consumeDocumentReminders();
  }

  private async consumeNotifications() {
    await this.rabbitMQService.consume(
      QUEUES.NOTIFICATION_PUSH,
      async (message) => {
        const { type, userId, title, body, data } = message;

        // 1. In-app notification yaratish (DB ga saqlash)
        await this.createInAppNotification(userId, title, body, data);

        // 2. Push notification yuborish (OneSignal)
        await this.sendPushNotification(userId, title, body, data);
      },
    );
  }

  private async consumeDocumentReminders() {
    await this.rabbitMQService.consume(
      QUEUES.DOCUMENT_REMINDER,
      async (message) => {
        const { userIds, documentName, documentNumber, companyId, departmentId } =
          message;

        const title = 'Hujjat tasdiqlash kutilmoqda';
        const body = `"${documentName}" (${documentNumber}) hujjati tasdiqlashni kutmoqda`;

        for (const userId of userIds) {
          // In-app notification
          await this.createInAppNotification(userId, title, body, {
            type: NotificationType.DOCUMENT_REMINDER,
            companyId,
            departmentId,
          });

          // Push notification
          await this.sendPushNotification(userId, title, body, {
            type: NotificationType.DOCUMENT_REMINDER,
            companyId,
            departmentId,
          });
        }
      },
    );
  }

  private async createInAppNotification(
    userId: string,
    title: string,
    body: string,
    data?: any,
  ) {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title,
          body,
          data: data || {},
          isRead: false,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create notification for ${userId}:`, error);
    }
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: any,
  ) {
    if (!this.oneSignalService) {
      this.logger.debug(`[Push] Would send to ${userId}: ${title}`);
      return;
    }

    try {
      await this.oneSignalService.sendPush({ userId, title, body, data });
    } catch (error) {
      this.logger.error(`Failed to send push notification to ${userId}:`, error);
    }
  }
}
