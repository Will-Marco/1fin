import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  onesignalConfig,
  rabbitmqConfig,
  redisConfig,
  s3Config,
} from './config';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { FilesModule } from './modules/files/files.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { UsersModule } from './modules/users/users.module';
import { QueuesModule } from './queues/queues.module';

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
    CacheModule.register({
      isGlobal: true,
      ttl: 300000, // 5 daqiqa (milliseconds)
      max: 100, // maksimum 100 ta element
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
    FilesModule,
    ArchiveModule,
    StatisticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
