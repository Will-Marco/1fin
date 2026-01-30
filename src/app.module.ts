import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  jwtConfig,
  databaseConfig,
  s3Config,
  redisConfig,
  rabbitmqConfig,
  onesignalConfig,
} from './config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { MessagesModule } from './modules/messages/messages.module';
import { QueuesModule } from './queues/queues.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
        databaseConfig,
        s3Config,
        redisConfig,
        rabbitmqConfig,
        onesignalConfig,
      ],
    }),
    DatabaseModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    DepartmentsModule,
    MessagesModule,
    QueuesModule,
    NotificationsModule,
    JobsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
