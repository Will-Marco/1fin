import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../firebase.service';
import { PrismaService } from '../../../database/prisma.service';

jest.mock('firebase-admin', () => {
  const sendEachForMulticast = jest.fn();
  return {
    apps: [{ name: 'test-app' }],
    messaging: jest.fn(() => ({ sendEachForMulticast })),
    initializeApp: jest.fn(),
    credential: { cert: jest.fn() },
    // testda ichidan olish uchun
    __sendEachForMulticast: sendEachForMulticast,
  };
});

const sendMock = (admin as unknown as { __sendEachForMulticast: jest.Mock })
  .__sendEachForMulticast;

/** Bitta token uchun FCM per-token javobini yasaydi. */
const failure = (code: string) => ({
  success: false,
  error: { code, message: `simulated ${code}` },
});
const success = () => ({ success: true });

describe('FirebaseService token cleanup', () => {
  let service: FirebaseService;
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const findMany = jest.fn();
  const notificationCount = jest.fn().mockResolvedValue(0);

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
        {
          provide: PrismaService,
          useValue: {
            deviceToken: { findMany, updateMany },
            notification: { count: notificationCount },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(FirebaseService);
    // onModuleInit'ni chetlab, app'ni to'g'ridan-to'g'ri o'rnatamiz
    (service as unknown as { app: unknown }).app = { name: 'test-app' };
  });

  it('deactivates invalid-argument and not-registered tokens, but NOT third-party-auth-error', async () => {
    findMany.mockResolvedValue([
      { fcmToken: 'tok-ok' },
      { fcmToken: 'tok-invalid-arg' },
      { fcmToken: 'tok-not-registered' },
      { fcmToken: 'tok-apns-config' },
    ]);

    sendMock.mockResolvedValue({
      successCount: 1,
      failureCount: 3,
      responses: [
        success(),
        failure('messaging/invalid-argument'),
        failure('messaging/registration-token-not-registered'),
        failure('messaging/third-party-auth-error'),
      ],
    });

    await service.sendPush({ userId: 'u1', title: 'T', body: 'B' });

    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.data).toEqual({ isActive: false });
    // APNs config xatosi (third-party-auth-error) deactivate QILINMAYDI
    expect(arg.where.fcmToken.in.sort()).toEqual(
      ['tok-invalid-arg', 'tok-not-registered'].sort(),
    );
    expect(arg.where.fcmToken.in).not.toContain('tok-apns-config');
  });

  it('does not call updateMany when nothing is permanently dead', async () => {
    findMany.mockResolvedValue([{ fcmToken: 'tok-apns-config' }]);
    sendMock.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      responses: [failure('messaging/third-party-auth-error')],
    });

    await service.sendPush({ userId: 'u1', title: 'T', body: 'B' });

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('includes the unread count as badge (aps.badge + android.notificationCount + data.unreadCount)', async () => {
    findMany.mockResolvedValue([{ fcmToken: 'tok-ok' }]);
    notificationCount.mockResolvedValue(7);
    sendMock.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [success()],
    });

    await service.sendPush({ userId: 'u1', title: 'T', body: 'B' });

    expect(notificationCount).toHaveBeenCalledWith({
      where: { userId: 'u1', isRead: false },
    });
    const msg = sendMock.mock.calls[0][0];
    expect(msg.apns.payload.aps.badge).toBe(7);
    expect(msg.android.notification.notificationCount).toBe(7);
    expect(msg.data.unreadCount).toBe('7');
  });
});
