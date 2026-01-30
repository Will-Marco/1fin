import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { MessagesGateway } from './messages.gateway';
import { QueuesModule } from '../../queues/queues.module';

@Module({
  imports: [
    forwardRef(() => QueuesModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [MessagesController, DocumentsController],
  providers: [MessagesService, DocumentsService, MessagesGateway],
  exports: [MessagesService, DocumentsService, MessagesGateway],
})
export class MessagesModule {}
