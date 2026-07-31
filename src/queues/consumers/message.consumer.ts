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

      // Sender dan boshqa a'zolar
      const candidateUserIds = memberships
        .filter((m) => m.userId !== payload.senderId)
        .map((m) => m.userId);

      // Ayni paytda shu bo'lim chatida AKTIV turganlar (socket room'ida) — ularga
      // notification yubormaymiz VA bo'limni ular uchun o'qilgan deb belgilaymiz,
      // aks holda ochiq turgan chatning unread count'i oshib ketardi.
      const activeUserIds = new Set(
        await this.messagesGateway.getActiveUserIds(
          payload.companyId,
          payload.globalDepartmentId,
        ),
      );

      const activeRecipients = candidateUserIds.filter((id) =>
        activeUserIds.has(id),
      );
      const offlineUserIds = candidateUserIds.filter(
        (id) => !activeUserIds.has(id),
      );

      // Aktiv ko'rib turganlar uchun lastReadAt'ni yangilaymiz → unread oshmaydi.
      if (activeRecipients.length > 0) {
        await this.markDepartmentReadForActiveUsers(
          activeRecipients,
          payload.companyId,
          payload.globalDepartmentId,
        );
      }

      // Faqat aktiv BO'LMAGANlarga notification (bell + FCM).
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

  /**
   * Chatni aktiv ko'rib turgan user'lar uchun bo'lim read holatini yangilaydi
   * (lastReadAt = now). Shu tufayli unread-summary o'sha yangi xabarni sanamaydi.
   */
  private async markDepartmentReadForActiveUsers(
    userIds: string[],
    companyId: string,
    globalDepartmentId: string,
  ) {
    const now = new Date();
    await Promise.all(
      userIds.map((userId) =>
        this.prisma.userDepartmentRead.upsert({
          where: {
            userId_companyId_globalDepartmentId: {
              userId,
              companyId,
              globalDepartmentId,
            },
          },
          update: { lastReadAt: now },
          create: { userId, companyId, globalDepartmentId, lastReadAt: now },
        }),
      ),
    );
  }
}
