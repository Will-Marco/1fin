import { Module, forwardRef } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { MessageProducer, NotificationProducer } from './producers';
import { MessageConsumer, NotificationConsumer } from './consumers';
import { MessagesModule } from '../modules/messages/messages.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => MessagesModule),
    NotificationsModule,
  ],
  providers: [
    RabbitMQService,
    // Producers
    MessageProducer,
    NotificationProducer,
    // Consumers
    MessageConsumer,
    NotificationConsumer,
  ],
  exports: [
    RabbitMQService,
    MessageProducer,
    NotificationProducer,
  ],
})
export class QueuesModule {}
