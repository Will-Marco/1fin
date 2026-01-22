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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
