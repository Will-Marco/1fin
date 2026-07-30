import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FirebaseService } from './firebase.service';
import { NotificationsGateway } from './notifications.gateway';
import { DevicePlatform } from '../../../generated/prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private firebaseService: FirebaseService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Read-state o'zgarishini user'ning BARCHA qurilmalariga real-time yuborish
   * (Telegram-uslub: bir qurilmada o'qilsa/o'chirilsa — hammasida sinxron).
   * Socket emit sinsa ham REST javobi buzilmasligi uchun try/catch.
   */
  private async syncRead(
    userId: string,
    event: string,
    payload: Record<string, any> = {},
  ) {
    try {
      const unreadCount = await this.prisma.notification.count({
        where: { userId, isRead: false },
      });
      // Aniq event (ro'yxatni yangilash uchun) + badge count (bir xil manba).
      this.notificationsGateway.emitToUser(userId, event, {
        ...payload,
        unreadCount,
      });
      this.notificationsGateway.emitToUser(userId, 'notification:unread-count', {
        unreadCount,
      });
    } catch (error) {
      this.logger.error(`Read-state sync failed for ${userId}:`, error);
    }
  }

  /**
   * Register (or re-assign) an FCM token to the current user.
   * fcmToken is globally unique — if it was previously tied to another user
   * (same physical device, different account), it gets reassigned here.
   */
  async registerDeviceToken(
    userId: string,
    fcmToken: string,
    platform: DevicePlatform,
  ) {
    return this.prisma.deviceToken.upsert({
      where: { fcmToken },
      update: {
        userId,
        platform,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        fcmToken,
        platform,
        isActive: true,
      },
      select: {
        id: true,
        fcmToken: true,
        platform: true,
        isActive: true,
        lastSeenAt: true,
      },
    });
  }

  /**
   * List the current user's registered (active) devices.
   * Mobile/web can call this to verify its token is registered on the server.
   */
  async getUserDevices(userId: string) {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        fcmToken: true,
        platform: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    return { data: devices, meta: { total: devices.length } };
  }

  /**
   * Deactivate a specific FCM token for the current user (e.g. logout on that device).
   * Scoped to userId to prevent removing a token that has already been
   * reassigned to someone else on the same physical device.
   */
  async unregisterDeviceToken(userId: string, fcmToken: string) {
    const result = await this.prisma.deviceToken.updateMany({
      where: { userId, fcmToken },
      data: { isActive: false },
    });
    return { unregistered: result.count };
  }

  async create(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    sendPush = true,
  ) {
    // In-app notification yaratish
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        data: data || {},
      },
    });

    // Push notification yuborish
    if (sendPush) {
      await this.firebaseService.sendPush({
        userId,
        title,
        body,
        data,
      });
    }

    return notification;
  }

  async createBulk(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
    sendPush = true,
  ) {
    // In-app notifications yaratish
    const notifications = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title,
        body,
        data: data || {},
      })),
    });

    // Push notifications yuborish
    if (sendPush && userIds.length > 0) {
      await this.firebaseService.sendBulkPush({
        userIds,
        title,
        body,
        data,
      });
    }

    return { count: notifications.count };
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      data: notifications,
      meta: {
        total,
        unreadCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    await this.syncRead(userId, 'notification:read', { id: notificationId });

    return updated;
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    await this.syncRead(userId, 'notification:read-all');

    return { message: 'All notifications marked as read' };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { unreadCount: count };
  }

  async delete(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    // O'chirilgan notification o'qilmagan bo'lsa badge o'zgaradi — sinxronlaymiz.
    await this.syncRead(userId, 'notification:deleted', { id: notificationId });

    return { message: 'Notification deleted' };
  }

  async deleteAll(userId: string) {
    await this.prisma.notification.deleteMany({
      where: { userId },
    });

    await this.syncRead(userId, 'notification:deleted-all');

    return { message: 'All notifications deleted' };
  }
}
