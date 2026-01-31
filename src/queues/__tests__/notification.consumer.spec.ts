import { Test, TestingModule } from '@nestjs/testing';
import { NotificationConsumer } from '../consumers/notification.consumer';
import { RabbitMQService } from '../rabbitmq.service';
import { PrismaService } from '../../database/prisma.service';
import { OneSignalService } from '../../modules/notifications/onesignal.service';
import { NotificationType } from '../producers';

describe('NotificationConsumer', () => {
  let consumer: NotificationConsumer;

  const mockRabbitMQService = {
    isReady: jest.fn(),
    consume: jest.fn(),
  };

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
    },
  };

  const mockOneSignalService = {
    sendPush: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationConsumer,
        { provide: RabbitMQService, useValue: mockRabbitMQService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OneSignalService, useValue: mockOneSignalService },
      ],
    }).compile();

    consumer = module.get<NotificationConsumer>(NotificationConsumer);
  });

  describe('notification handlers', () => {
    let notificationHandler: (message: any) => Promise<void>;
    let documentReminderHandler: (message: any) => Promise<void>;

    beforeEach(() => {
      mockRabbitMQService.consume.mockImplementation(
        async (queue: string, handler: (message: any) => Promise<void>) => {
          if (queue === 'notifications.push') notificationHandler = handler;
          if (queue === 'documents.reminder') documentReminderHandler = handler;
        },
      );
      mockRabbitMQService.isReady.mockReturnValue(true);
    });

    describe('consumeNotifications', () => {
      beforeEach(async () => {
        await (consumer as any).consumeNotifications();
      });

      it('should create in-app notification and send push', async () => {
        mockPrismaService.notification.create.mockResolvedValue({});
        mockOneSignalService.sendPush.mockResolvedValue(true);

        const message = {
          type: NotificationType.NEW_MESSAGE,
          userId: 'user-id',
          title: 'New Message',
          body: 'You have a new message',
          data: { departmentId: 'dept-id' },
        };

        await notificationHandler(message);

        expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
          data: {
            userId: 'user-id',
            title: 'New Message',
            body: 'You have a new message',
            data: { departmentId: 'dept-id' },
            isRead: false,
          },
        });

        expect(mockOneSignalService.sendPush).toHaveBeenCalledWith({
          userId: 'user-id',
          title: 'New Message',
          body: 'You have a new message',
          data: { departmentId: 'dept-id' },
        });
      });

      it('should handle notification without data', async () => {
        mockPrismaService.notification.create.mockResolvedValue({});
        mockOneSignalService.sendPush.mockResolvedValue(true);

        const message = {
          type: NotificationType.NEW_MESSAGE,
          userId: 'user-id',
          title: 'Test',
          body: 'Test body',
        };

        await notificationHandler(message);

        expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
          data: {
            userId: 'user-id',
            title: 'Test',
            body: 'Test body',
            data: {},
            isRead: false,
          },
        });
      });

      it('should handle document approved notification', async () => {
        mockPrismaService.notification.create.mockResolvedValue({});
        mockOneSignalService.sendPush.mockResolvedValue(true);

        const message = {
          type: NotificationType.DOCUMENT_APPROVED,
          userId: 'user-id',
          title: 'Document Approved',
          body: 'Your document has been approved',
          data: { documentId: 'doc-id' },
        };

        await notificationHandler(message);

        expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            title: 'Document Approved',
          }),
        });
      });
    });

    describe('consumeDocumentReminders', () => {
      beforeEach(async () => {
        await (consumer as any).consumeDocumentReminders();
      });

      it('should create notifications for multiple users', async () => {
        mockPrismaService.notification.create.mockResolvedValue({});
        mockOneSignalService.sendPush.mockResolvedValue(true);

        const message = {
          userIds: ['user-1', 'user-2'],
          documentName: 'Contract',
          documentNumber: 'DOC-001',
          companyId: 'company-id',
          departmentId: 'dept-id',
        };

        await documentReminderHandler(message);

        expect(mockPrismaService.notification.create).toHaveBeenCalledTimes(2);

        expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
          data: {
            userId: 'user-1',
            title: 'Hujjat tasdiqlash kutilmoqda',
            body: '"Contract" (DOC-001) hujjati tasdiqlashni kutmoqda',
            data: {
              type: NotificationType.DOCUMENT_REMINDER,
              companyId: 'company-id',
              departmentId: 'dept-id',
            },
            isRead: false,
          },
        });

        expect(mockOneSignalService.sendPush).toHaveBeenCalledTimes(2);
      });

      it('should handle empty userIds array', async () => {
        const message = {
          userIds: [],
          documentName: 'Contract',
          documentNumber: 'DOC-001',
          companyId: 'company-id',
          departmentId: 'dept-id',
        };

        await documentReminderHandler(message);

        expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
        expect(mockOneSignalService.sendPush).not.toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    let notificationHandler: (message: any) => Promise<void>;

    beforeEach(async () => {
      mockRabbitMQService.consume.mockImplementation(
        async (queue: string, handler: (message: any) => Promise<void>) => {
          if (queue === 'notifications.push') notificationHandler = handler;
        },
      );
      mockRabbitMQService.isReady.mockReturnValue(true);
      await (consumer as any).consumeNotifications();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.notification.create.mockRejectedValue(
        new Error('Database error'),
      );

      const message = {
        type: NotificationType.NEW_MESSAGE,
        userId: 'user-id',
        title: 'Test',
        body: 'Test body',
      };

      // Should not throw - errors are logged but not propagated
      await notificationHandler(message);

      expect(mockPrismaService.notification.create).toHaveBeenCalled();
    });

    it('should handle push notification errors gracefully', async () => {
      mockPrismaService.notification.create.mockResolvedValue({});
      mockOneSignalService.sendPush.mockRejectedValue(
        new Error('Push failed'),
      );

      const message = {
        type: NotificationType.NEW_MESSAGE,
        userId: 'user-id',
        title: 'Test',
        body: 'Test body',
      };

      // Should not throw - errors are logged but not propagated
      await notificationHandler(message);

      expect(mockOneSignalService.sendPush).toHaveBeenCalled();
    });
  });

  describe('isReady check', () => {
    it('should not consume when RabbitMQ is not ready', async () => {
      mockRabbitMQService.isReady.mockReturnValue(false);

      await (consumer as any).startConsuming();

      expect(mockRabbitMQService.consume).not.toHaveBeenCalled();
    });

    it('should consume when RabbitMQ is ready', async () => {
      mockRabbitMQService.isReady.mockReturnValue(true);
      mockRabbitMQService.consume.mockResolvedValue(undefined);

      await (consumer as any).startConsuming();

      expect(mockRabbitMQService.consume).toHaveBeenCalledTimes(2);
    });
  });
});
