import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { JwtAuthGuard } from '../../auth/guards';

/**
 * Route TARTIBI testlari.
 *
 * Oddiy unit testlar controller metodini to'g'ridan-to'g'ri chaqiradi va
 * routing'ni chetlab o'tadi — shuning uchun ular @Delete(':id') ning
 * @Delete('devices') ni to'sib qo'yishini KO'RMAYDI. Bu test HTTP orqali
 * yuborib, aynan qaysi handler chaqirilganini tekshiradi.
 */
describe('NotificationsController routing', () => {
  let app: INestApplication;

  const service = {
    registerDeviceToken: jest.fn().mockResolvedValue({ id: 'dt-1' }),
    unregisterDeviceToken: jest.fn().mockResolvedValue({ unregistered: 1 }),
    delete: jest.fn().mockResolvedValue({ message: 'Notification deleted' }),
    deleteAll: jest.fn().mockResolvedValue({ message: 'ok', count: 0 }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: 'user-1' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('DELETE /notifications/devices unregisters the device', async () => {
    await request(app.getHttpServer())
      .delete('/notifications/devices')
      .send({ fcmToken: 'token-abc' })
      .expect(200);

    expect(service.unregisterDeviceToken).toHaveBeenCalledWith(
      'user-1',
      'token-abc',
    );
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('DELETE /notifications/:id still deletes a notification', async () => {
    await request(app.getHttpServer())
      .delete('/notifications/some-notification-id')
      .expect(200);

    expect(service.delete).toHaveBeenCalledWith(
      'some-notification-id',
      'user-1',
    );
    expect(service.unregisterDeviceToken).not.toHaveBeenCalled();
  });
});
