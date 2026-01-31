import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '../rabbitmq.service';

// Mock amqplib
jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

import * as amqp from 'amqplib';

describe('RabbitMQService', () => {
  let service: RabbitMQService;
  let configService: ConfigService;

  const mockChannel = {
    assertExchange: jest.fn(),
    assertQueue: jest.fn(),
    bindQueue: jest.fn(),
    publish: jest.fn(),
    sendToQueue: jest.fn(),
    consume: jest.fn(),
    ack: jest.fn(),
    nack: jest.fn(),
    close: jest.fn(),
  };

  const mockConnection = {
    createChannel: jest.fn().mockResolvedValue(mockChannel),
    on: jest.fn(),
    close: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitMQService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RabbitMQService>(RabbitMQService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('onModuleInit', () => {
    it('should connect to RabbitMQ when URL is configured', async () => {
      mockConfigService.get.mockReturnValue('amqp://localhost:5672');

      await service.onModuleInit();

      expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost:5672');
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(service.isReady()).toBe(true);
    });

    it('should skip connection when URL is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await service.onModuleInit();

      expect(amqp.connect).not.toHaveBeenCalled();
      expect(service.isReady()).toBe(false);
    });

    it('should handle connection errors gracefully', async () => {
      mockConfigService.get.mockReturnValue('amqp://localhost:5672');
      (amqp.connect as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await service.onModuleInit();

      expect(service.isReady()).toBe(false);
    });
  });

  describe('publish', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('amqp://localhost:5672');
      await service.onModuleInit();
    });

    it('should publish message to exchange', async () => {
      const result = await service.publish('test-exchange', 'test-key', { data: 'test' });

      expect(result).toBe(true);
      expect(mockChannel.publish).toHaveBeenCalledWith(
        'test-exchange',
        'test-key',
        expect.any(Buffer),
        { persistent: true },
      );
    });

    it('should return false when not connected', async () => {
      // Create new service without connection
      const newService = new RabbitMQService(configService);

      const result = await newService.publish('test-exchange', 'test-key', { data: 'test' });

      expect(result).toBe(false);
    });
  });

  describe('sendToQueue', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('amqp://localhost:5672');
      await service.onModuleInit();
    });

    it('should send message to queue', async () => {
      const result = await service.sendToQueue('test-queue', { data: 'test' });

      expect(result).toBe(true);
      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Buffer),
        { persistent: true },
      );
    });

    it('should return false when not connected', async () => {
      const newService = new RabbitMQService(configService);

      const result = await newService.sendToQueue('test-queue', { data: 'test' });

      expect(result).toBe(false);
    });
  });

  describe('consume', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('amqp://localhost:5672');
      await service.onModuleInit();
    });

    it('should start consuming from queue', async () => {
      const callback = jest.fn();

      await service.consume('test-queue', callback);

      expect(mockChannel.consume).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Function),
        { noAck: false },
      );
    });

    it('should not consume when not connected', async () => {
      const newService = new RabbitMQService(configService);
      const callback = jest.fn();

      await newService.consume('test-queue', callback);

      expect(mockChannel.consume).not.toHaveBeenCalled();
    });
  });

  describe('getChannel', () => {
    it('should return channel when connected', async () => {
      mockConfigService.get.mockReturnValue('amqp://localhost:5672');
      await service.onModuleInit();

      expect(service.getChannel()).toBe(mockChannel);
    });

    it('should return null when not connected', () => {
      expect(service.getChannel()).toBeNull();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close connections', async () => {
      mockConfigService.get.mockReturnValue('amqp://localhost:5672');
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });
  });
});
