import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { MessagesGateway } from '../../modules/messages/messages.gateway';
import { MessageConsumer } from '../consumers/message.consumer';
import { NotificationProducer, NotificationType } from '../producers';
import { RabbitMQService } from '../rabbitmq.service';

describe('MessageConsumer', () => {
  let consumer: MessageConsumer;

  const mockRabbitMQService = {
    isReady: jest.fn(),
    consume: jest.fn(),
  };

  const mockMessagesGateway = {
    emitToRoom: jest.fn(),
  };

  const mockNotificationProducer = {
    sendToMany: jest.fn(),
  };

  const mockPrismaService = {
    userCompanyMembership: {
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
      mockRabbitMQService.consume.mockImplementation(
        async (queue: string, handler: (message: any) => Promise<void>) => {
          if (queue === 'messages.send') newMessageHandler = handler;
          if (queue === 'messages.edit') editMessageHandler = handler;
          if (queue === 'messages.delete') deleteMessageHandler = handler;
        },
      );
      mockRabbitMQService.isReady.mockReturnValue(true);
    });

    describe('new message handler', () => {
      beforeEach(async () => {
        await (consumer as any).consumeNewMessages();
      });

      it('should emit new message via WebSocket', async () => {
        const payload = {
          messageId: 'msg-1',
          companyId: 'comp-1',
          globalDepartmentId: 'dept-1',
          content: 'Hello',
          sender: { id: 'u1', name: 'User' },
        };

        mockPrismaService.userCompanyMembership.findMany.mockResolvedValue([]);

        await newMessageHandler({ payload });

        expect(mockMessagesGateway.emitToRoom).toHaveBeenCalledWith(
          'comp-1',
          'dept-1',
          'message:new',
          payload,
        );
      });

      it('should send notifications to offline members', async () => {
        const payload = {
          messageId: 'msg-1',
          companyId: 'comp-1',
          globalDepartmentId: 'dept-1',
          senderId: 'u1',
          content: 'Hello',
          sender: { name: 'User' },
        };

        mockPrismaService.userCompanyMembership.findMany.mockResolvedValue([
          { userId: 'u1' },
          { userId: 'u2' },
          { userId: 'u3' },
        ]);

        await newMessageHandler({ payload });

        expect(mockNotificationProducer.sendToMany).toHaveBeenCalledWith(
          ['u2', 'u3'],
          expect.objectContaining({
            type: NotificationType.NEW_MESSAGE,
            title: 'Yangi xabar - User',
          })
        );
      });
    });

    describe('edit message handler', () => {
      it('should emit edited message', async () => {
        await (consumer as any).consumeEditedMessages();
        const payload = { companyId: 'c1', globalDepartmentId: 'd1', messageId: 'm1' };
        await editMessageHandler({ payload });
        expect(mockMessagesGateway.emitToRoom).toHaveBeenCalledWith('c1', 'd1', 'message:edited', payload);
      });
    });

    describe('delete message handler', () => {
      it('should emit deleted message', async () => {
        await (consumer as any).consumeDeletedMessages();
        const payload = { companyId: 'c1', globalDepartmentId: 'd1', messageId: 'm1' };
        await deleteMessageHandler({ payload });
        expect(mockMessagesGateway.emitToRoom).toHaveBeenCalledWith('c1', 'd1', 'message:deleted', { messageId: 'm1' });
      });
    });
  });
});
