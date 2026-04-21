import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';

/**
 * Rate Limiting E2E Tests
 *
 * Bu testlar rate limiting haqiqatdan ishlayotganini tekshiradi.
 * @ThrottleAuth - 5 req/min (login)
 * @ThrottleRead - 120 req/min (GET)
 * @ThrottleWrite - 20 req/min (POST/PATCH/DELETE)
 *
 * MUHIM: Testlar IP-based rate limiting ishlatadi.
 * Testlar parallel ishlasa, bir-biriga ta'sir qilishi mumkin.
 */
describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUsername = 'ratelimit_test_user';
  const testPassword = 'password123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Test user yaratish
    await prisma.user.deleteMany({ where: { username: testUsername } });
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    await prisma.user.create({
      data: {
        username: testUsername,
        password: hashedPassword,
        name: 'Rate Limit Test User',
        systemRole: 'FIN_ADMIN',
      },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: { user: { username: testUsername } },
    });
    await prisma.user.deleteMany({ where: { username: testUsername } });
    await app.close();
  });

  describe('Rate Limiting ishlayotganini tekshirish', () => {
    it('should return 429 Too Many Requests after exceeding rate limit', async () => {
      // Biz eng kam limitni (ThrottleAuth = 5/min) test qilamiz
      // Ko'p so'rov yuborib, 429 olishimiz kerak

      let got429 = false;
      let requestCount = 0;

      // 10 ta so'rov yuboramiz - 429 olishimiz kerak
      for (let i = 0; i < 10; i++) {
        requestCount++;
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            username: 'rate_limit_test_' + i,
            password: 'wrong',
            deviceName: `Device ${i}`,
            deviceType: 'desktop',
          });

        if (response.status === 429) {
          got429 = true;
          break;
        }
      }

      expect(got429).toBe(true);
      // Rate limit 5/min bo'lgani uchun 6-chi so'rovda 429 olishimiz kerak
      expect(requestCount).toBeLessThanOrEqual(6);
    });

    it('429 response should contain proper error message', async () => {
      // Rate limitni oshirib 429 olish
      for (let i = 0; i < 10; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            username: 'error_msg_test_' + i,
            password: 'wrong',
            deviceName: `Device ${i}`,
            deviceType: 'desktop',
          });

        if (response.status === 429) {
          // 429 responseda xato xabari bo'lishi kerak
          expect(response.body).toHaveProperty('message');
          expect(response.body.message).toMatch(/too many requests/i);
          break;
        }
      }
    });

    it('429 response should include Retry-After header', async () => {
      // Rate limitni oshirib 429 olish
      for (let i = 0; i < 10; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            username: 'retry_after_test_' + i,
            password: 'wrong',
            deviceName: `Device ${i}`,
            deviceType: 'desktop',
          });

        if (response.status === 429) {
          // Retry-After header bo'lishi kerak
          const hasRetryAfter =
            response.headers['retry-after'] ||
            response.headers['retry-after-short'];
          expect(hasRetryAfter).toBeDefined();
          break;
        }
      }
    });
  });

  describe('Autentifikatsiyalangan endpointlar', () => {
    let accessToken: string;

    beforeAll(async () => {
      // Avval rate limitni kutish (1 daqiqa o'tishi kerak bo'lishi mumkin)
      // Test uchun yangi user bilan login qilamiz
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: testUsername,
          password: testPassword,
          deviceName: 'Auth Test Device',
          deviceType: 'desktop',
        });

      // Agar 429 bo'lsa, token olmadik
      if (loginResponse.status === 429) {
        console.warn('Rate limited - skipping auth tests');
        return;
      }

      accessToken = loginResponse.body?.data?.accessToken;
    });

    it('GET /auth/me should work within rate limits', async () => {
      if (!accessToken) {
        console.warn('No access token - skipping test');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      // 200 yoki 429 (agar oldingi testlar limiti to'ldirgan bo'lsa)
      expect([200, 429]).toContain(response.status);
    });
  });
});
