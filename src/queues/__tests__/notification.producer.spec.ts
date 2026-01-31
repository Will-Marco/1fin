import { Test, TestingModule } from '@nestjs/testing';
import { NotificationProducer, NotificationType, NotificationPayload } from '../producers/notification.producer';
import { RabbitMQService } from '../rabbitmq.service';
import { EXCHANGES, ROUTING_KEYS } from '../constants';

describe('NotificationProducer', () => {
  let producer: NotificationProducer;
  let rabbitMQService: RabbitMQService;

  const mockRabbitMQService = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProducer,
        { provide: RabbitMQService, useValue: mockRabbitMQService },
      ],
    }).compile();

    producer = module.get<NotificationProducer>(NotificationProducer);
    rabbitMQService = module.get<RabbitMQService>(RabbitMQService);
  });

  describe('send', () => {
    it('should publish notification to exchange', async () => {
      const payload: NotificationPayload = {
        type: NotificationType.NEW_MESSAGE,
        userId: 'user-id',
        title: 'New Message',
        body: 'You have a new message',
        data: {
          departmentId: 'dept-id',
          messageId: 'msg-id',
        },
      };

      await producer.send(payload);

      expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
        EXCHANGES.NOTIFICATIONS,
        ROUTING_KEYS.NOTIFICATION_NEW,
        {
          ...payload,
          timestamp: expect.any(Date),
        },
      );
    });

    it('should publish document approved notification', async () => {
      const payload: NotificationPayload = {
        type: NotificationType.DOCUMENT_APPROVED,
        userId: 'user-id',
        title: 'Document Approved',
        body: 'Your document has been approved',
        data: {
          documentId: 'doc-id',
          companyId: 'company-id',
        },
      };

      await producer.send(payload);

      expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
        EXCHANGES.NOTIFICATIONS,
        ROUTING_KEYS.NOTIFICATION_NEW,
        expect.objectContaining({
          type: NotificationType.DOCUMENT_APPROVED,
          title: 'Document Approved',
        }),
      );
    });
  });

  describe('sendToMany', () => {
    it('should send notification to multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const notification = {
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        body: 'You have a new message',
        data: { departmentId: 'dept-id' },
      };

      await producer.sendToMany(userIds, notification);

      expect(mockRabbitMQService.publish).toHaveBeenCalledTimes(3);

      userIds.forEach((userId) => {
        expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
          EXCHANGES.NOTIFICATIONS,
          ROUTING_KEYS.NOTIFICATION_NEW,
          expect.objectContaining({
            userId,
            title: 'New Message',
          }),
        );
      });
    });

    it('should handle empty user array', async () => {
      const notification = {
        type: NotificationType.NEW_MESSAGE,
        title: 'Test',
        body: 'Test body',
      };

      await producer.sendToMany([], notification);

      expect(mockRabbitMQService.publish).not.toHaveBeenCalled();
    });
  });

  describe('sendDocumentReminder', () => {
    it('should publish document reminder to exchange', async () => {
      const payload = {
        userIds: ['user-1', 'user-2'],
        documentId: 'doc-id',
        documentName: 'Contract',
        documentNumber: 'DOC-001',
        companyId: 'company-id',
        departmentId: 'dept-id',
      };

      await producer.sendDocumentReminder(payload);

      expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
        EXCHANGES.DOCUMENTS,
        ROUTING_KEYS.DOCUMENT_PENDING,
        {
          type: NotificationType.DOCUMENT_REMINDER,
          ...payload,
          timestamp: expect.any(Date),
        },
      );
    });
  });
});
