import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MessagesGateway } from '../../modules/messages/messages.gateway';
import { QUEUES } from '../constants';
import { NotificationProducer, NotificationType } from '../producers';
import { RabbitMQService } from '../rabbitmq.service';

@Injectable()
export class MessageConsumer implements OnModuleInit {
  private readonly logger = new Logger(MessageConsumer.name);

  constructor(
    private rabbitMQService: RabbitMQService,
    private messagesGateway: MessagesGateway,
    private notificationProducer: NotificationProducer,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    // Register on every (re)connection — consumers re-bind after RabbitMQ reconnects
    this.rabbitMQService.onConnect(() => this.startConsuming());
  }

  private async startConsuming() {
    await this.consumeNewMessages();
    await this.consumeEditedMessages();
    await this.consumeDeletedMessages();
    this.logger.log('Message consumers registered');
  }

  private async consumeNewMessages() {
    await this.rabbitMQService.consume(QUEUES.MESSAGE_SEND, async (message) => {
      const { payload } = message;

      // 1. WebSocket orqali online userlarga yuborish
      this.messagesGateway.emitToRoom(
        payload.companyId,
        payload.globalDepartmentId,
        'message:new',
        payload,
      );

      // 2. Offline userlar uchun notification
      await this.sendNotificationToOfflineUsers(payload);
    });
  }

  private async consumeEditedMessages() {
    await this.rabbitMQService.consume(QUEUES.MESSAGE_EDIT, (message) => {
      const { payload } = message;

      // WebSocket orqali yuborish
      this.messagesGateway.emitToRoom(
        payload.companyId,
        payload.globalDepartmentId,
        'message:edited',
        payload,
      );
    });
  }

  private async consumeDeletedMessages() {
    await this.rabbitMQService.consume(QUEUES.MESSAGE_DELETE, (message) => {
      const { payload } = message;

      // WebSocket orqali yuborish
      this.messagesGateway.emitToRoom(
        payload.companyId,
        payload.globalDepartmentId,
        'message:deleted',
        { messageId: payload.messageId },
      );
    });
  }

  private async sendNotificationToOfflineUsers(payload: any) {
    try {
      // Company a'zolarini va ularning department accessini olish
      const memberships = await this.prisma.userCompanyMembership.findMany({
        where: {
          companyId: payload.companyId,
          isActive: true,
          allowedDepartments: {
            some: { globalDepartmentId: payload.globalDepartmentId },
          },
        },
        select: { userId: true },
      });

      // Sender dan boshqa a'zolarga notification yuborish
      const offlineUserIds = memberships
        .filter((m) => m.userId !== payload.senderId)
        .map((m) => m.userId);

      // System staff ga ham yuborish (optional, but for simplicity we can include them if they were active)
      // For now, only company members.

      if (offlineUserIds.length > 0) {
        await this.notificationProducer.sendToMany(offlineUserIds, {
          type: NotificationType.NEW_MESSAGE,
          title: `Yangi xabar - ${payload.sender.name}`,
          body: payload.content?.substring(0, 100) || 'Yangi xabar',
          data: {
            companyId: payload.companyId,
            globalDepartmentId: payload.globalDepartmentId,
            messageId: payload.messageId,
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send notifications:', error);
    }
  }
}
