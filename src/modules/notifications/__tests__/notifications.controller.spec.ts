import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
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

  const mockNotificationsService = {
    findAll: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
    deleteAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      const mockResult = {
        data: [mockNotification],
        meta: { total: 1, unreadCount: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockNotificationsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll('user-id', '1', '20');

      expect(result).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalledWith('user-id', 1, 20);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue({ unreadCount: 5 });

      const result = await controller.getUnreadCount('user-id');

      expect(result.unreadCount).toBe(5);
      expect(service.getUnreadCount).toHaveBeenCalledWith('user-id');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockNotificationsService.markAsRead.mockResolvedValue({
        ...mockNotification,
        isRead: true,
      });

      const result = await controller.markAsRead('notif-id', 'user-id');

      expect(result.isRead).toBe(true);
      expect(service.markAsRead).toHaveBeenCalledWith('notif-id', 'user-id');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({
        message: 'All notifications marked as read',
      });

      const result = await controller.markAllAsRead('user-id');

      expect(result.message).toBe('All notifications marked as read');
      expect(service.markAllAsRead).toHaveBeenCalledWith('user-id');
    });
  });

  describe('delete', () => {
    it('should delete a notification', async () => {
      mockNotificationsService.delete.mockResolvedValue({
        message: 'Notification deleted',
      });

      const result = await controller.delete('notif-id', 'user-id');

      expect(result.message).toBe('Notification deleted');
      expect(service.delete).toHaveBeenCalledWith('notif-id', 'user-id');
    });
  });

  describe('deleteAll', () => {
    it('should delete all notifications', async () => {
      mockNotificationsService.deleteAll.mockResolvedValue({
        message: 'All notifications deleted',
      });

      const result = await controller.deleteAll('user-id');

      expect(result.message).toBe('All notifications deleted');
      expect(service.deleteAll).toHaveBeenCalledWith('user-id');
    });
  });
});
