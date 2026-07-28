import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebaseService } from './firebase.service';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.accessSecret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebaseService, NotificationsGateway],
  exports: [NotificationsService, FirebaseService, NotificationsGateway],
})
export class NotificationsModule {}
