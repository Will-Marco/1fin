import { Test, TestingModule } from '@nestjs/testing';
import { CronLockService } from '../cron-lock.service';
import { REDIS_CLIENT } from '../redis.constants';

describe('CronLockService', () => {
  let service: CronLockService;

  const mockRedis = {
    set: jest.fn(),
    quit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.NODE_APP_INSTANCE;
    delete process.env.pm_id;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronLockService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<CronLockService>(CronLockService);
  });

  it('runs the task when the lock is acquired', async () => {
    mockRedis.set.mockResolvedValue('OK');
    const task = jest.fn().mockResolvedValue(undefined);

    const ran = await service.runWithLock('cron:x', 1000, task);

    expect(ran).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'cron:x',
      expect.any(String),
      'PX',
      1000,
      'NX',
    );
  });

  it('skips the task when the lock is already held (SET NX returns null)', async () => {
    mockRedis.set.mockResolvedValue(null);
    const task = jest.fn();

    const ran = await service.runWithLock('cron:x', 1000, task);

    expect(ran).toBe(false);
    expect(task).not.toHaveBeenCalled();
  });

  describe('Redis error fallback (PM2 instance guard)', () => {
    it('runs on the primary instance (NODE_APP_INSTANCE=0)', async () => {
      process.env.NODE_APP_INSTANCE = '0';
      mockRedis.set.mockRejectedValue(new Error('redis down'));
      const task = jest.fn().mockResolvedValue(undefined);

      const ran = await service.runWithLock('cron:x', 1000, task);

      expect(ran).toBe(true);
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('skips on a non-primary instance (NODE_APP_INSTANCE=2)', async () => {
      process.env.NODE_APP_INSTANCE = '2';
      mockRedis.set.mockRejectedValue(new Error('redis down'));
      const task = jest.fn();

      const ran = await service.runWithLock('cron:x', 1000, task);

      expect(ran).toBe(false);
      expect(task).not.toHaveBeenCalled();
    });

    it('runs when not under PM2 (no instance id) so dev/single-process still fires', async () => {
      mockRedis.set.mockRejectedValue(new Error('redis down'));
      const task = jest.fn().mockResolvedValue(undefined);

      const ran = await service.runWithLock('cron:x', 1000, task);

      expect(ran).toBe(true);
      expect(task).toHaveBeenCalledTimes(1);
    });
  });
});
