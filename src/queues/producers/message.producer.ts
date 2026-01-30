import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq.service';
import { EXCHANGES, ROUTING_KEYS } from '../constants';

export interface MessagePayload {
  messageId: string;
  departmentId: string;
  senderId: string;
  content?: string;
  type: string;
  replyToId?: string;
  createdAt: Date;
  sender: {
    id: string;
    username: string;
    name: string;
    avatar?: string;
  };
}

export interface MessageEditPayload {
  messageId: string;
  departmentId: string;
  content: string;
  editedAt: Date;
}

export interface MessageDeletePayload {
  messageId: string;
  departmentId: string;
  deletedBy: string;
  deletedAt: Date;
}

@Injectable()
export class MessageProducer {
  constructor(private rabbitMQService: RabbitMQService) {}

  async sendNewMessage(payload: MessagePayload) {
    await this.rabbitMQService.publish(
      EXCHANGES.MESSAGES,
      ROUTING_KEYS.MESSAGE_NEW,
      {
        type: 'MESSAGE_NEW',
        payload,
        timestamp: new Date(),
      },
    );
  }

  async sendEditedMessage(payload: MessageEditPayload) {
    await this.rabbitMQService.publish(
      EXCHANGES.MESSAGES,
      ROUTING_KEYS.MESSAGE_EDITED,
      {
        type: 'MESSAGE_EDITED',
        payload,
        timestamp: new Date(),
      },
    );
  }

  async sendDeletedMessage(payload: MessageDeletePayload) {
    await this.rabbitMQService.publish(
      EXCHANGES.MESSAGES,
      ROUTING_KEYS.MESSAGE_DELETED,
      {
        type: 'MESSAGE_DELETED',
        payload,
        timestamp: new Date(),
      },
    );
  }
}
