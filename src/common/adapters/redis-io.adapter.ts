import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

/**
 * Socket.IO uchun Redis adapter.
 *
 * NEGA KERAK: prod'da PM2 `cluster` mode + `instances: 'max'` — ya'ni har CPU
 * yadrosiga bitta Node process. Odatiy (in-memory) adapter'da `server.to(room)
 * .emit()` faqat O'SHA process'dagi socket'larga boradi. User socket'i boshqa
 * process'da bo'lsa — emit yetmaydi (chat ham, notification ham yo'qoladi).
 *
 * Redis adapter barcha process'lar orasida emit'larni pub/sub orqali tarqatadi,
 * shuning uchun istalgan process'dan qilingan emit hamma yo'qori socket'larga
 * yetib boradi. Single-instance'da ham xavfsiz — shunchaki bitta obuna.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const configService = this.app.get(ConfigService);
    const host = configService.get<string>('redis.host', 'localhost');
    const port = configService.get<number>('redis.port', 6379);
    const password = configService.get<string | undefined>('redis.password');

    this.pubClient = new Redis({ host, port, password });
    this.subClient = this.pubClient.duplicate();

    this.pubClient.on('error', (err) =>
      this.logger.error(`Redis pub client error: ${err.message}`),
    );
    this.subClient.on('error', (err) =>
      this.logger.error(`Redis sub client error: ${err.message}`),
    );

    // ioredis avtomatik ulanadi, lekin adapter yaratishdan oldin ulanish tayyor
    // bo'lishini kutamiz. Redis o'chiq bo'lsa bootstrap abadiy osilib qolmasin —
    // 10s timeout bilan aniq xato beramiz.
    const waitReady = (client: Redis) =>
      client.status === 'ready'
        ? Promise.resolve()
        : new Promise<void>((res) => client.once('ready', () => res()));

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Redis ulanish timeout (10s) — server ishlamayapti?')),
        10_000,
      ),
    );

    await Promise.race([
      Promise.all([waitReady(this.pubClient), waitReady(this.subClient)]),
      timeout,
    ]);

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    this.logger.log('Socket.IO Redis adapter ulandi');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    } else {
      this.logger.warn(
        'Redis adapter yaratilmagan — in-memory adapter ishlatilmoqda',
      );
    }
    return server;
  }
}
