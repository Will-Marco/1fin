import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq.service';
import { QUEUES } from '../constants';
import { MessagesGateway } from '../../modules/messages/messages.gateway';
import { NotificationProducer, NotificationType } from '../producers';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MessageConsumer implements OnModuleInit {
  private readonly logger = new Logger(MessageConsumer.name);

  constructor(
    private rabbitMQService: RabbitMQService,
    private messagesGateway: MessagesGateway,
    private notificationProducer: NotificationProducer,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Wait a bit for RabbitMQ to connect
    setTimeout(() => this.startConsuming(), 2000);
  }

  private async startConsuming() {
    if (!this.rabbitMQService.isReady()) {
      this.logger.warn('RabbitMQ not ready, message consumers not started');
      return;
    }

    await this.consumeNewMessages();
    await this.consumeEditedMessages();
    await this.consumeDeletedMessages();
  }

  private async consumeNewMessages() {
    await this.rabbitMQService.consume(QUEUES.MESSAGE_SEND, async (message) => {
      const { payload } = message;

      // 1. WebSocket orqali online userlarga yuborish
      this.messagesGateway.emitNewMessage(payload.departmentId, payload);

      // 2. Offline userlar uchun notification
      await this.sendNotificationToOfflineUsers(payload);
    });
  }

  private async consumeEditedMessages() {
    await this.rabbitMQService.consume(QUEUES.MESSAGE_EDIT, async (message) => {
      const { payload } = message;

      // WebSocket orqali yuborish
      this.messagesGateway.emitMessageEdited(payload.departmentId, payload);
    });
  }

  private async consumeDeletedMessages() {
    await this.rabbitMQService.consume(QUEUES.MESSAGE_DELETE, async (message) => {
      const { payload } = message;

      // WebSocket orqali yuborish
      this.messagesGateway.emitMessageDeleted(
        payload.departmentId,
        payload.messageId,
      );
    });
  }

  private async sendNotificationToOfflineUsers(payload: any) {
    try {
      // Department a'zolarini olish
      const members = await this.prisma.departmentMember.findMany({
        where: { departmentId: payload.departmentId },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });

      // Sender dan boshqa a'zolarga notification
      const offlineUserIds = members
        .filter((m) => m.userId !== payload.senderId)
        .map((m) => m.userId);

      if (offlineUserIds.length > 0) {
        await this.notificationProducer.sendToMany(offlineUserIds, {
          type: NotificationType.NEW_MESSAGE,
          title: `Yangi xabar - ${payload.sender.name}`,
          body: payload.content?.substring(0, 100) || 'Yangi xabar',
          data: {
            departmentId: payload.departmentId,
            messageId: payload.messageId,
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send notifications:', error);
    }
  }
}
