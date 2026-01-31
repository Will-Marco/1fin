import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { OneSignalService } from '../onesignal.service';
import { PrismaService } from '../../../database/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockNotification = {
    id: 'notif-id',
    userId: 'user-id',
    title: 'Test Title',
    body: 'Test Body',
    data: {},
    isRead: false,
    readAt: null,
    createdAt: new Date(),
  };

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockOneSignalService = {
    sendPush: jest.fn(),
    sendBulkPush: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OneSignalService, useValue: mockOneSignalService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create notification and send push', async () => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);
      mockOneSignalService.sendPush.mockResolvedValue(true);

      const result = await service.create(
        'user-id',
        'Test Title',
        'Test Body',
        { key: 'value' },
      );

      expect(result).toEqual(mockNotification);
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          title: 'Test Title',
          body: 'Test Body',
          data: { key: 'value' },
        },
      });
      expect(mockOneSignalService.sendPush).toHaveBeenCalled();
    });

    it('should create notification without push if sendPush is false', async () => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      await service.create('user-id', 'Title', 'Body', {}, false);

      expect(mockOneSignalService.sendPush).not.toHaveBeenCalled();
    });
  });

  describe('createBulk', () => {
    it('should create multiple notifications', async () => {
      mockPrismaService.notification.createMany.mockResolvedValue({ count: 3 });
      mockOneSignalService.sendBulkPush.mockResolvedValue(true);

      const result = await service.createBulk(
        ['user-1', 'user-2', 'user-3'],
        'Title',
        'Body',
      );

      expect(result.count).toBe(3);
      expect(mockOneSignalService.sendBulkPush).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([mockNotification]);
      mockPrismaService.notification.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1); // unread

      const result = await service.findAll('user-id', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.unreadCount).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      });

      const result = await service.markAsRead('notif-id', 'user-id');

      expect(result.isRead).toBe(true);
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-id' },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.markAsRead('invalid', 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-id');

      expect(result.message).toBe('All notifications marked as read');
      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', isRead: false },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockPrismaService.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-id');

      expect(result.unreadCount).toBe(5);
    });
  });

  describe('delete', () => {
    it('should delete a notification', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrismaService.notification.delete.mockResolvedValue(mockNotification);

      const result = await service.delete('notif-id', 'user-id');

      expect(result.message).toBe('Notification deleted');
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('invalid', 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAll', () => {
    it('should delete all notifications', async () => {
      mockPrismaService.notification.deleteMany.mockResolvedValue({ count: 10 });

      const result = await service.deleteAll('user-id');

      expect(result.message).toBe('All notifications deleted');
    });
  });
});
