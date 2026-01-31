import { Test, TestingModule } from '@nestjs/testing';
import { MessageProducer, MessagePayload, MessageEditPayload, MessageDeletePayload } from '../producers/message.producer';
import { RabbitMQService } from '../rabbitmq.service';
import { EXCHANGES, ROUTING_KEYS } from '../constants';

describe('MessageProducer', () => {
  let producer: MessageProducer;
  let rabbitMQService: RabbitMQService;

  const mockRabbitMQService = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageProducer,
        { provide: RabbitMQService, useValue: mockRabbitMQService },
      ],
    }).compile();

    producer = module.get<MessageProducer>(MessageProducer);
    rabbitMQService = module.get<RabbitMQService>(RabbitMQService);
  });

  describe('sendNewMessage', () => {
    it('should publish new message to exchange', async () => {
      const payload: MessagePayload = {
        messageId: 'msg-id',
        departmentId: 'dept-id',
        senderId: 'user-id',
        content: 'Hello World',
        type: 'TEXT',
        createdAt: new Date(),
        sender: {
          id: 'user-id',
          username: 'testuser',
          name: 'Test User',
        },
      };

      await producer.sendNewMessage(payload);

      expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
        EXCHANGES.MESSAGES,
        ROUTING_KEYS.MESSAGE_NEW,
        {
          type: 'MESSAGE_NEW',
          payload,
          timestamp: expect.any(Date),
        },
      );
    });

    it('should include replyToId when present', async () => {
      const payload: MessagePayload = {
        messageId: 'msg-id',
        departmentId: 'dept-id',
        senderId: 'user-id',
        content: 'Reply message',
        type: 'TEXT',
        replyToId: 'original-msg-id',
        createdAt: new Date(),
        sender: {
          id: 'user-id',
          username: 'testuser',
          name: 'Test User',
        },
      };

      await producer.sendNewMessage(payload);

      expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
        EXCHANGES.MESSAGES,
        ROUTING_KEYS.MESSAGE_NEW,
        expect.objectContaining({
          payload: expect.objectContaining({
            replyToId: 'original-msg-id',
          }),
        }),
      );
    });
  });

  describe('sendEditedMessage', () => {
    it('should publish edited message to exchange', async () => {
      const payload: MessageEditPayload = {
        messageId: 'msg-id',
        departmentId: 'dept-id',
        content: 'Updated content',
        editedAt: new Date(),
      };

      await producer.sendEditedMessage(payload);

      expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
        EXCHANGES.MESSAGES,
        ROUTING_KEYS.MESSAGE_EDITED,
        {
          type: 'MESSAGE_EDITED',
          payload,
          timestamp: expect.any(Date),
        },
      );
    });
  });

  describe('sendDeletedMessage', () => {
    it('should publish deleted message to exchange', async () => {
      const payload: MessageDeletePayload = {
        messageId: 'msg-id',
        departmentId: 'dept-id',
        deletedBy: 'user-id',
        deletedAt: new Date(),
      };

      await producer.sendDeletedMessage(payload);

      expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
        EXCHANGES.MESSAGES,
        ROUTING_KEYS.MESSAGE_DELETED,
        {
          type: 'MESSAGE_DELETED',
          payload,
          timestamp: expect.any(Date),
        },
      );
    });
  });
});
