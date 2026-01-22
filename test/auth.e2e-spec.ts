import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testPhone = '+998901234567';
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
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  describe('/api/v1/auth/register (POST)', () => {
    beforeEach(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});
    });

    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: testPhone,
          password: testPassword,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'Test Device',
          deviceType: 'desktop',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.phone).toBe(testPhone);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should fail with invalid phone format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: 'invalid-phone',
          password: testPassword,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'Test Device',
          deviceType: 'desktop',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate phone', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: testPhone,
          password: testPassword,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'Test Device',
          deviceType: 'desktop',
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: testPhone,
          password: testPassword,
          firstName: 'Jane',
          lastName: 'Doe',
          deviceName: 'Test Device 2',
          deviceType: 'mobile',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Phone number already exists');
    });
  });

  describe('/api/v1/auth/login (POST)', () => {
    beforeAll(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: testPhone,
          password: testPassword,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'Test Device',
          deviceType: 'desktop',
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: testPhone,
          password: testPassword,
          deviceName: 'Login Device',
          deviceType: 'mobile',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.phone).toBe(testPhone);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should fail with wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: testPhone,
          password: 'wrongpassword',
          deviceName: 'Login Device',
          deviceType: 'mobile',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail with non-existent phone', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: '+998909999999',
          password: testPassword,
          deviceName: 'Login Device',
          deviceType: 'mobile',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('/api/v1/auth/me (GET)', () => {
    let accessToken: string;

    beforeAll(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: testPhone,
          password: testPassword,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'Test Device',
          deviceType: 'desktop',
        });

      accessToken = registerResponse.body.data.accessToken;
    });

    it('should return current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.phone).toBe(testPhone);
      expect(response.body.data.firstName).toBe('John');
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('/api/v1/auth/sessions (GET)', () => {
    let accessToken: string;

    beforeAll(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: testPhone,
          password: testPassword,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'Device 1',
          deviceType: 'desktop',
        });

      accessToken = registerResponse.body.data.accessToken;

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: testPhone,
          password: testPassword,
          deviceName: 'Device 2',
          deviceType: 'mobile',
        });
    });

    it('should return all user sessions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('/api/v1/auth/logout (POST)', () => {
    let accessToken: string;

    beforeEach(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: testPhone,
          password: testPassword,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'Test Device',
          deviceType: 'desktop',
        });

      accessToken = registerResponse.body.data.accessToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Logged out successfully');

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('Session limit (max 3 devices)', () => {
    beforeEach(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: testPhone,
          password: testPassword,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'Device 1',
          deviceType: 'desktop',
        });
    });

    it('should remove oldest session when 4th device logs in', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: testPhone,
          password: testPassword,
          deviceName: 'Device 2',
          deviceType: 'mobile',
        });

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: testPhone,
          password: testPassword,
          deviceName: 'Device 3',
          deviceType: 'tablet',
        });

      const fourthLoginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: testPhone,
          password: testPassword,
          deviceName: 'Device 4',
          deviceType: 'desktop',
        });

      const sessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set(
          'Authorization',
          `Bearer ${fourthLoginResponse.body.data.accessToken}`,
        )
        .expect(200);

      expect(sessionsResponse.body.data.length).toBe(3);

      const deviceNames = sessionsResponse.body.data.map(
        (s: any) => s.deviceName,
      );
      expect(deviceNames).not.toContain('Device 1');
      expect(deviceNames).toContain('Device 4');
    });
  });
});
