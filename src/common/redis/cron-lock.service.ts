import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class CronLockService implements OnModuleDestroy {
  private readonly logger = new Logger(CronLockService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Redis distributed lock — cluster/ko'p-server muhitida bir vaqtda ishga
   * tushgan cron'lardan FAQAT bittasi bajarilishini kafolatlaydi.
   *
   * Lock ATAYLAB o'chirilmaydi — TTL tugaguncha turadi. Barcha instance'lar cron
   * ayni soniyada firing qiladi; birinchi bo'lib lock olgan bajaradi, qolganlari
   * lock borligini ko'rib o'tkazib yuboradi. TTL keyingi kunlik ishga tushishdan
   * ancha oldin tugaydi.
   *
   * Manual trigger'lar bu wrapper'ni CHETLAB O'TISHI kerak (har doim ishlashi uchun).
   */
  async runWithLock(
    key: string,
    ttlMs: number,
    task: () => Promise<void>,
  ): Promise<boolean> {
    let acquired: string | null;
    try {
      acquired = await this.redis.set(key, randomUUID(), 'PX', ttlMs, 'NX');
    } catch (error) {
      // Redis yiqilsa cron butunlay to'xtab qolmasligi kerak. Fallback: faqat
      // PM2 instance-0 bajaradi — dublikatsiz va o'tkazib yubormasdan.
      this.logger.error(
        `[${key}] Redis lock xatosi — PM2 instance guard fallback:`,
        error,
      );
      if (this.isPrimaryInstance()) {
        await task();
        return true;
      }
      return false;
    }

    if (acquired !== 'OK') {
      this.logger.log(`[${key}] boshqa instance bajarmoqda — o'tkazib yuborildi`);
      return false;
    }

    this.logger.log(`[${key}] lock olindi — bajarilmoqda`);
    await task();
    return true;
  }

  /**
   * PM2 cluster'da har fork'ga NODE_APP_INSTANCE (0,1,2...) beriladi. PM2 ostida
   * bo'lmasa (dev / single process) — undefined, uni ham "primary" deb qaraymiz.
   */
  private isPrimaryInstance(): boolean {
    const id = process.env.NODE_APP_INSTANCE ?? process.env.pm_id;
    return id === undefined || id === '0';
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      // ignore — shutdown
    }
  }
}
