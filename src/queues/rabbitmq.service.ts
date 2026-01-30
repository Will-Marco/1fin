import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { EXCHANGES, QUEUES } from './constants';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly logger = new Logger(RabbitMQService.name);
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.close();
  }

  private async connect(): Promise<void> {
    const url = this.configService.get<string>('rabbitmq.url');

    if (!url) {
      this.logger.warn('RabbitMQ URL not configured, skipping connection');
      return;
    }

    try {
      this.logger.log(`Connecting to RabbitMQ at ${url}`);

      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;

      // Handle connection errors
      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error:', err.message);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
      });

      this.logger.log('Successfully connected to RabbitMQ');

      // Setup queues after successful connection
      await this.setupQueues();
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
      this.logger.warn('Server will continue without RabbitMQ');
      this.isConnected = false;
      // Don't throw - allow server to start without RabbitMQ
    }
  }

  private async setupQueues() {
    if (!this.channel) {
      return;
    }

    try {
      // Setup exchanges
      await this.channel.assertExchange(EXCHANGES.MESSAGES, 'direct', {
        durable: true,
      });
      await this.channel.assertExchange(EXCHANGES.NOTIFICATIONS, 'direct', {
        durable: true,
      });
      await this.channel.assertExchange(EXCHANGES.DOCUMENTS, 'direct', {
        durable: true,
      });

      // Setup queues
      await this.channel.assertQueue(QUEUES.MESSAGE_SEND, { durable: true });
      await this.channel.assertQueue(QUEUES.MESSAGE_EDIT, { durable: true });
      await this.channel.assertQueue(QUEUES.MESSAGE_DELETE, { durable: true });
      await this.channel.assertQueue(QUEUES.NOTIFICATION_PUSH, {
        durable: true,
      });
      await this.channel.assertQueue(QUEUES.DOCUMENT_REMINDER, {
        durable: true,
      });

      // Bind queues to exchanges
      await this.channel.bindQueue(
        QUEUES.MESSAGE_SEND,
        EXCHANGES.MESSAGES,
        'message.new',
      );
      await this.channel.bindQueue(
        QUEUES.MESSAGE_EDIT,
        EXCHANGES.MESSAGES,
        'message.edited',
      );
      await this.channel.bindQueue(
        QUEUES.MESSAGE_DELETE,
        EXCHANGES.MESSAGES,
        'message.deleted',
      );
      await this.channel.bindQueue(
        QUEUES.NOTIFICATION_PUSH,
        EXCHANGES.NOTIFICATIONS,
        'notification.new',
      );
      await this.channel.bindQueue(
        QUEUES.DOCUMENT_REMINDER,
        EXCHANGES.DOCUMENTS,
        'document.pending',
      );

      this.logger.log('RabbitMQ queues setup completed');
    } catch (error) {
      this.logger.error(`Failed to setup queues: ${error.message}`);
    }
  }

  async publish(exchange: string, routingKey: string, message: any) {
    if (!this.isConnected || !this.channel) {
      this.logger.warn(`Cannot publish to ${exchange}: RabbitMQ not connected`);
      return false;
    }

    try {
      const content = Buffer.from(JSON.stringify(message));
      this.channel.publish(exchange, routingKey, content, {
        persistent: true,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to publish message: ${error.message}`);
      return false;
    }
  }

  async sendToQueue(queue: string, message: any) {
    if (!this.isConnected || !this.channel) {
      this.logger.warn(`Cannot send to ${queue}: RabbitMQ not connected`);
      return false;
    }

    try {
      const content = Buffer.from(JSON.stringify(message));
      this.channel.sendToQueue(queue, content, {
        persistent: true,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send to queue: ${error.message}`);
      return false;
    }
  }

  async consume(
    queue: string,
    callback: (message: any) => Promise<void>,
    options?: { noAck?: boolean },
  ) {
    if (!this.isConnected || !this.channel) {
      this.logger.warn(`Cannot consume from ${queue}: RabbitMQ not connected`);
      return;
    }

    try {
      await this.channel.consume(
        queue,
        async (msg) => {
          if (msg && this.channel) {
            try {
              const content = JSON.parse(msg.content.toString());
              await callback(content);
              if (!options?.noAck) {
                this.channel.ack(msg);
              }
            } catch (error) {
              this.logger.error(
                `Error processing message from ${queue}:`,
                error,
              );
              // Reject and requeue on error
              this.channel.nack(msg, false, true);
            }
          }
        },
        { noAck: options?.noAck || false },
      );

      this.logger.log(`Started consuming from queue: ${queue}`);
    } catch (error) {
      this.logger.error(`Failed to consume from ${queue}: ${error.message}`);
    }
  }

  getChannel(): amqp.Channel | null {
    return this.channel;
  }

  isReady(): boolean {
    return this.isConnected && this.channel !== null;
  }

  private async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ connection: ${error.message}`);
    }
  }
}
