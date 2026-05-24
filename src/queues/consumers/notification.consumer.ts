import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq.service';
import { QUEUES } from '../constants';
import { PrismaService } from '../../database/prisma.service';
import { NotificationType } from '../producers';
import { FirebaseService } from '../../modules/notifications/firebase.service';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private rabbitMQService: RabbitMQService,
    private prisma: PrismaService,
    private firebaseService: FirebaseService,
  ) {}

  onModuleInit() {
    // Register on every (re)connection — consumers re-bind after RabbitMQ reconnects
    this.rabbitMQService.onConnect(() => this.startConsuming());
  }

  private async startConsuming() {
    await this.consumeNotifications();
    await this.consumeDocumentReminders();
    this.logger.log('Notification consumers registered');
  }

  private async consumeNotifications() {
    await this.rabbitMQService.consume(
      QUEUES.NOTIFICATION_PUSH,
      async (message) => {
        const { userId, title, body, data } = message;

        // 1. In-app notification yaratish (DB ga saqlash)
        await this.createInAppNotification(userId, title, body, data);

        // 2. Push notification yuborish (FCM)
        await this.sendPushNotification(userId, title, body, data);
      },
    );
  }

  private async consumeDocumentReminders() {
    await this.rabbitMQService.consume(
      QUEUES.DOCUMENT_REMINDER,
      async (message) => {
        const {
          userIds,
          documentId,
          documentName,
          documentNumber,
          companyId,
          globalDepartmentId,
        } = message;

        const title = 'Hujjat tasdiqlash kutilmoqda';
        const body = `"${documentName}" (${documentNumber}) hujjati tasdiqlashni kutmoqda`;

        const data = {
          type: NotificationType.DOCUMENT_REMINDER,
          companyId,
          globalDepartmentId,
          documentId,
          documentNumber,
        };

        for (const userId of userIds) {
          await this.createInAppNotification(userId, title, body, data);
          await this.sendPushNotification(userId, title, body, data);
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
    try {
      await this.firebaseService.sendPush({ userId, title, body, data });
    } catch (error) {
      this.logger.error(
        `Failed to send push notification to ${userId}:`,
        error,
      );
    }
  }
}
