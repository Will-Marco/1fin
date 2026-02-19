import { Injectable } from '@nestjs/common';
import { EXCHANGES, ROUTING_KEYS } from '../constants';
import { RabbitMQService } from '../rabbitmq.service';

export enum NotificationType {
  NEW_MESSAGE = 'NEW_MESSAGE',
  MESSAGE_REPLY = 'MESSAGE_REPLY',
  DOCUMENT_PENDING = 'DOCUMENT_PENDING',
  DOCUMENT_APPROVED = 'DOCUMENT_APPROVED',
  DOCUMENT_REJECTED = 'DOCUMENT_REJECTED',
  DOCUMENT_REMINDER = 'DOCUMENT_REMINDER',
}

export interface NotificationPayload {
  type: NotificationType;
  userId: string;       // kimga yuboriladi
  title: string;
  body: string;
  data?: {
    departmentId?: string;
    messageId?: string;
    documentId?: string;
    companyId?: string;
    [key: string]: any;
  };
}

@Injectable()
export class NotificationProducer {
  constructor(private rabbitMQService: RabbitMQService) {}

  async send(payload: NotificationPayload) {
    await this.rabbitMQService.publish(
      EXCHANGES.NOTIFICATIONS,
      ROUTING_KEYS.NOTIFICATION_NEW,
      {
        ...payload,
        timestamp: new Date(),
      },
    );
  }

  async sendToMany(userIds: string[], notification: Omit<NotificationPayload, 'userId'>) {
    const promises = userIds.map((userId) =>
      this.send({
        ...notification,
        userId,
      }),
    );
    await Promise.all(promises);
  }

  async sendDocumentReminder(payload: {
    userIds: string[];
    documentId: string;
    documentName: string;
    documentNumber: string;
    companyId: string;
    globalDepartmentId: string;
  }) {
    await this.rabbitMQService.publish(
      EXCHANGES.DOCUMENTS,
      ROUTING_KEYS.DOCUMENT_PENDING,
      {
        type: NotificationType.DOCUMENT_REMINDER,
        ...payload,
        timestamp: new Date(),
      },
    );
  }
}
