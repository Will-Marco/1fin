import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUsername = 'testadmin';
  const testPassword = 'password123';
  const testName = 'Test Admin';

  async function createTestUser(
    username = testUsername,
    password = testPassword,
    name = testName,
    role: string = 'ADMIN',
  ) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        systemRole: role as any,
      },
    });
  }

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

  describe('/api/v1/auth/login (POST)', () => {
    beforeEach(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});
      await createTestUser();
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: testUsername,
          password: testPassword,
          deviceName: 'Test Device',
          deviceType: 'desktop',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe(testUsername);
      expect(response.body.data.user.name).toBe(testName);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should return mustChangePassword flag', async () => {
      await prisma.user.deleteMany({});
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      await prisma.user.create({
        data: {
          username: 'tempuser',
          password: hashedPassword,
          name: 'Temp User',
          systemRole: 'OPERATOR' as any,
          mustChangePassword: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'tempuser',
          password: testPassword,
          deviceName: 'Test Device',
          deviceType: 'desktop',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.mustChangePassword).toBe(true);
    });

    it('should fail with wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: testUsername,
          password: 'wrongpassword',
          deviceName: 'Test Device',
          deviceType: 'desktop',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail with non-existent username', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent',
          password: testPassword,
          deviceName: 'Test Device',
          deviceType: 'desktop',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail with missing fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: testUsername,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('/api/v1/auth/me (GET)', () => {
    let accessToken: string;

    beforeAll(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});
      await createTestUser();

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: testUsername,
          password: testPassword,
          deviceName: 'Test Device',
          deviceType: 'desktop',
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should return current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe(testUsername);
      expect(response.body.data.name).toBe(testName);
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
      await createTestUser();

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: testUsername,
          password: testPassword,
          deviceName: 'Device 1',
          deviceType: 'desktop',
        });

      accessToken = loginResponse.body.data.accessToken;

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: testUsername,
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
      await createTestUser();

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: testUsername,
          password: testPassword,
          deviceName: 'Test Device',
          deviceType: 'desktop',
        });

      accessToken = loginResponse.body.data.accessToken;
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
      await createTestUser();
    });

    it('should remove oldest session when 4th device logs in', async () => {
      const login = (deviceName: string, deviceType: string) =>
        request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            username: testUsername,
            password: testPassword,
            deviceName,
            deviceType,
          });

      await login('Device 1', 'desktop');
      await login('Device 2', 'mobile');
      await login('Device 3', 'tablet');

      const fourthLoginResponse = await login('Device 4', 'desktop');

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
