import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CronLockService } from './cron-lock.service';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Umumiy Redis client (ioredis) + distributed lock. @Global — bir marta
 * yuklanadi, CronLockService hamma joyda inject qilinadi.
 *
 * NB: Socket.IO Redis adapter (main.ts) alohida pub/sub ulanish yaratadi —
 * u DI konteynerdan oldin bootstrap bo'lgani uchun alohida qoladi.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string | undefined>('redis.password'),
        }),
      inject: [ConfigService],
    },
    CronLockService,
  ],
  exports: [REDIS_CLIENT, CronLockService],
})
export class RedisModule {}
