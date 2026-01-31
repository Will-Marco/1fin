import { Test, TestingModule } from '@nestjs/testing';
import { MessageConsumer } from '../consumers/message.consumer';
import { RabbitMQService } from '../rabbitmq.service';
import { MessagesGateway } from '../../modules/messages/messages.gateway';
import { NotificationProducer, NotificationType } from '../producers';
import { PrismaService } from '../../database/prisma.service';

describe('MessageConsumer', () => {
  let consumer: MessageConsumer;

  const mockRabbitMQService = {
    isReady: jest.fn(),
    consume: jest.fn(),
  };

  const mockMessagesGateway = {
    emitNewMessage: jest.fn(),
    emitMessageEdited: jest.fn(),
    emitMessageDeleted: jest.fn(),
  };

  const mockNotificationProducer = {
    sendToMany: jest.fn(),
  };

  const mockPrismaService = {
    departmentMember: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageConsumer,
        { provide: RabbitMQService, useValue: mockRabbitMQService },
        { provide: MessagesGateway, useValue: mockMessagesGateway },
        { provide: NotificationProducer, useValue: mockNotificationProducer },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    consumer = module.get<MessageConsumer>(MessageConsumer);
  });

  describe('message handlers', () => {
    let newMessageHandler: (message: any) => Promise<void>;
    let editMessageHandler: (message: any) => Promise<void>;
    let deleteMessageHandler: (message: any) => Promise<void>;

    beforeEach(() => {
      // Capture the handlers when consume is called
      mockRabbitMQService.consume.mockImplementation(
        async (queue: string, handler: (message: any) => Promise<void>) => {
          if (queue === 'messages.send') newMessageHandler = handler;
          if (queue === 'messages.edit') editMessageHandler = handler;
          if (queue === 'messages.delete') deleteMessageHandler = handler;
        },
      );

      // Manually call the private method via any cast
      mockRabbitMQService.isReady.mockReturnValue(true);
    });

    describe('new message handler', () => {
      beforeEach(async () => {
        // Simulate startConsuming by calling consume setup
        await (consumer as any).consumeNewMessages();
      });

      it('should emit new message via WebSocket', async () => {
        const payload = {
          messageId: 'msg-id',
          departmentId: 'dept-id',
          senderId: 'user-id',
          content: 'Hello',
          sender: { id: 'user-id', username: 'test', name: 'Test' },
        };

        mockPrismaService.departmentMember.findMany.mockResolvedValue([]);

        await newMessageHandler({ payload });

        expect(mockMessagesGateway.emitNewMessage).toHaveBeenCalledWith(
          'dept-id',
          payload,
        );
      });

      it('should send notifications to offline department members', async () => {
        const payload = {
          messageId: 'msg-id',
          departmentId: 'dept-id',
          senderId: 'sender-id',
          content: 'Hello World',
          sender: { id: 'sender-id', username: 'sender', name: 'Sender' },
        };

        mockPrismaService.departmentMember.findMany.mockResolvedValue([
          { userId: 'sender-id', user: { id: 'sender-id', name: 'Sender' } },
          { userId: 'member-1', user: { id: 'member-1', name: 'Member 1' } },
          { userId: 'member-2', user: { id: 'member-2', name: 'Member 2' } },
        ]);

        await newMessageHandler({ payload });

        expect(mockNotificationProducer.sendToMany).toHaveBeenCalledWith(
          ['member-1', 'member-2'], // sender excluded
          {
            type: NotificationType.NEW_MESSAGE,
            title: 'Yangi xabar - Sender',
            body: 'Hello World',
            data: {
              departmentId: 'dept-id',
              messageId: 'msg-id',
            },
          },
        );
      });

      it('should not send notifications when no other members', async () => {
        const payload = {
          messageId: 'msg-id',
          departmentId: 'dept-id',
          senderId: 'sender-id',
          content: 'Hello',
          sender: { id: 'sender-id', username: 'sender', name: 'Sender' },
        };

        mockPrismaService.departmentMember.findMany.mockResolvedValue([
          { userId: 'sender-id', user: { id: 'sender-id', name: 'Sender' } },
        ]);

        await newMessageHandler({ payload });

        expect(mockNotificationProducer.sendToMany).not.toHaveBeenCalled();
      });

      it('should truncate long message content in notification', async () => {
        const longContent = 'A'.repeat(200);
        const payload = {
          messageId: 'msg-id',
          departmentId: 'dept-id',
          senderId: 'sender-id',
          content: longContent,
          sender: { id: 'sender-id', username: 'sender', name: 'Sender' },
        };

        mockPrismaService.departmentMember.findMany.mockResolvedValue([
          { userId: 'member-1', user: { id: 'member-1', name: 'Member 1' } },
        ]);

        await newMessageHandler({ payload });

        expect(mockNotificationProducer.sendToMany).toHaveBeenCalledWith(
          ['member-1'],
          expect.objectContaining({
            body: 'A'.repeat(100), // truncated to 100 chars
          }),
        );
      });
    });

    describe('edit message handler', () => {
      beforeEach(async () => {
        await (consumer as any).consumeEditedMessages();
      });

      it('should emit edited message via WebSocket', async () => {
        const payload = {
          messageId: 'msg-id',
          departmentId: 'dept-id',
          content: 'Updated content',
        };

        await editMessageHandler({ payload });

        expect(mockMessagesGateway.emitMessageEdited).toHaveBeenCalledWith(
          'dept-id',
          payload,
        );
      });
    });

    describe('delete message handler', () => {
      beforeEach(async () => {
        await (consumer as any).consumeDeletedMessages();
      });

      it('should emit deleted message via WebSocket', async () => {
        const payload = {
          messageId: 'msg-id',
          departmentId: 'dept-id',
        };

        await deleteMessageHandler({ payload });

        expect(mockMessagesGateway.emitMessageDeleted).toHaveBeenCalledWith(
          'dept-id',
          'msg-id',
        );
      });
    });
  });

  describe('isReady check', () => {
    it('should not consume when RabbitMQ is not ready', async () => {
      mockRabbitMQService.isReady.mockReturnValue(false);

      // Manually trigger startConsuming
      await (consumer as any).startConsuming();

      expect(mockRabbitMQService.consume).not.toHaveBeenCalled();
    });

    it('should consume when RabbitMQ is ready', async () => {
      mockRabbitMQService.isReady.mockReturnValue(true);
      mockRabbitMQService.consume.mockResolvedValue(undefined);

      await (consumer as any).startConsuming();

      expect(mockRabbitMQService.consume).toHaveBeenCalledTimes(3);
    });
  });
});
