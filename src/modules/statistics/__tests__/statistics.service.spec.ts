import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentStatus } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { StatisticsPeriod } from '../dto/get-statistics.dto';
import { StatisticsService } from '../statistics.service';

describe('StatisticsService', () => {
  let service: StatisticsService;

  const mockPrismaService = {
    document: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    message: {
      groupBy: jest.fn(),
    },
    file: {
      aggregate: jest.fn(),
    },
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      // Default: cache miss
      mockCacheManager.get.mockResolvedValue(null);
    });

    it('should aggregate documents, messages, and files correctly', async () => {
      mockPrismaService.document.groupBy.mockResolvedValue([
        { status: DocumentStatus.ACCEPTED, _count: { _all: 5 } },
        { status: DocumentStatus.PENDING, _count: { _all: 2 } },
      ]);
      mockPrismaService.message.groupBy.mockResolvedValue([
        { type: 'TEXT', _count: { _all: 10 } },
        { type: 'FILE', _count: { _all: 3 } },
      ]);
      mockPrismaService.file.aggregate.mockResolvedValue({
        _count: { _all: 3 },
        _sum: { fileSize: 3000000 }, // ~2.86 MB
      });
      mockPrismaService.document.findMany.mockResolvedValue([
        {
          createdAt: new Date('2026-03-01T10:00:00Z'),
          approvedAt: new Date('2026-03-01T12:00:00Z'),
        },
      ]);

      const result = await service.getStatistics({
        period: StatisticsPeriod.MONTHLY,
      });

      expect(result.documents.total).toBe(7);
      expect(result.documents.accepted).toBe(5);
      expect(result.documents.avgResponseHours).toBe(2);
      expect(result.messages.total).toBe(13);
      expect(result.messages.byType.TEXT).toBe(10);
      expect(result.files.total).toBe(3);
      expect(result.period.from).toBeDefined();
      expect(result.period.to).toBeDefined();

      // Cache ga saqlanganligi
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should return cached result on cache hit', async () => {
      const cachedResult = {
        documents: { total: 100, accepted: 80 },
        messages: { total: 500 },
        files: { total: 50 },
        period: { from: '2026-03-01', to: '2026-03-31' },
      };
      mockCacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.getStatistics({
        period: StatisticsPeriod.MONTHLY,
      });

      expect(result).toEqual(cachedResult);
      // Database chaqirilmasligi kerak
      expect(mockPrismaService.document.groupBy).not.toHaveBeenCalled();
      expect(mockPrismaService.message.groupBy).not.toHaveBeenCalled();
    });

    it('should build different cache keys for different parameters', async () => {
      mockPrismaService.document.groupBy.mockResolvedValue([]);
      mockPrismaService.message.groupBy.mockResolvedValue([]);
      mockPrismaService.file.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _sum: { fileSize: 0 },
      });
      mockPrismaService.document.findMany.mockResolvedValue([]);

      await service.getStatistics({
        period: StatisticsPeriod.MONTHLY,
        companyId: 'company-1',
      });
      await service.getStatistics({
        period: StatisticsPeriod.MONTHLY,
        companyId: 'company-2',
      });

      // Ikki xil key bilan cache set qilinishi kerak
      expect(mockCacheManager.set).toHaveBeenCalledTimes(2);
      const calls = mockCacheManager.set.mock.calls;
      expect(calls[0][0]).toContain('company-1');
      expect(calls[1][0]).toContain('company-2');
    });
  });
});
