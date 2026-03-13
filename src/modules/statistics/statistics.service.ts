import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { endOfDay, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { DocumentStatus, MessageType } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GetStatisticsDto, StatisticsPeriod } from './dto/get-statistics.dto';

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 daqiqa
const CACHE_PREFIX = 'statistics:';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getStatistics(dto: GetStatisticsDto) {
    const { startDate, endDate } = this.getDateRange(dto.period, dto.from, dto.to);

    // Cache key yaratish
    const cacheKey = this.buildCacheKey(dto, startDate, endDate);

    // Cache dan tekshirish
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss: ${cacheKey}`);

    const baseWhere = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(dto.companyId && { companyId: dto.companyId }),
      ...(dto.globalDepartmentId && { globalDepartmentId: dto.globalDepartmentId }),
    };

    // Parallel hisoblashlar (barcha query'lar bir vaqtda)
    const [documentsRaw, messagesRaw, filesRaw, approvedDocs] = await Promise.all([
      // Documents by status
      this.prisma.document.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      // Messages by type
      this.prisma.message.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: { _all: true },
      }),
      // Files aggregate
      this.prisma.file.aggregate({
        where: baseWhere,
        _count: { _all: true },
        _sum: { fileSize: true },
      }),
      // Approved documents for avg response time
      this.prisma.document.findMany({
        where: {
          ...baseWhere,
          status: DocumentStatus.ACCEPTED,
          approvedAt: { not: null },
        },
        select: { createdAt: true, approvedAt: true },
      }),
    ]);

    const avgResponseHours = this.calculateAvgResponseHours(approvedDocs);

    // Shake values
    const documentsStats = {
      total: documentsRaw.reduce((acc, curr) => acc + curr._count._all, 0),
      accepted: documentsRaw.find((d) => d.status === DocumentStatus.ACCEPTED)?._count._all || 0,
      rejected: documentsRaw.find((d) => d.status === DocumentStatus.REJECTED)?._count._all || 0,
      autoExpired: documentsRaw.find((d) => d.status === DocumentStatus.AUTO_EXPIRED)?._count._all || 0,
      pending: documentsRaw.find((d) => d.status === DocumentStatus.PENDING)?._count._all || 0,
      avgResponseHours,
    };

    const messagesStats = {
      total: messagesRaw.reduce((acc, curr) => acc + curr._count._all, 0),
      byType: {
        TEXT: messagesRaw.find((m) => m.type === MessageType.TEXT)?._count._all || 0,
        FILE: messagesRaw.find((m) => m.type === MessageType.FILE)?._count._all || 0,
        VOICE: messagesRaw.find((m) => m.type === MessageType.VOICE)?._count._all || 0,
        DOCUMENT_FORWARD: messagesRaw.find((m) => m.type === MessageType.DOCUMENT_FORWARD)?._count._all || 0,
      },
    };

    const filesStats = {
      total: filesRaw._count._all || 0,
      totalSizeMB: filesRaw._sum.fileSize ? Number((filesRaw._sum.fileSize / (1024 * 1024)).toFixed(2)) : 0,
    };

    const result = {
      documents: documentsStats,
      messages: messagesStats,
      files: filesStats,
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
    };

    // Natijani cache ga saqlash
    await this.cacheManager.set(cacheKey, result, CACHE_TTL_MS);
    this.logger.debug(`Cached: ${cacheKey}`);

    return result;
  }

  private getDateRange(
    period: StatisticsPeriod = StatisticsPeriod.MONTHLY,
    from?: string,
    to?: string,
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case StatisticsPeriod.DAILY:
        startDate = startOfDay(now);
        break;
      case StatisticsPeriod.WEEKLY:
        startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
        break;
      case StatisticsPeriod.MONTHLY:
        startDate = startOfMonth(now);
        break;
      case StatisticsPeriod.CUSTOM:
        if (!from || !to) {
          throw new BadRequestException('CUSTOM period requires "from" and "to" dates.');
        }
        startDate = startOfDay(parseISO(from));
        endDate = endOfDay(parseISO(to));
        
        if (startDate > endDate) {
            throw new BadRequestException('"from" date must be before "to" date.');
        }
        break;
      default:
        startDate = startOfMonth(now);
    }

    return { startDate, endDate };
  }

  /**
   * Cache key yaratish
   */
  private buildCacheKey(dto: GetStatisticsDto, startDate: Date, endDate: Date): string {
    const parts = [
      CACHE_PREFIX,
      dto.companyId || 'all',
      dto.globalDepartmentId || 'all',
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
    ];
    return parts.join(':');
  }

  /**
   * Kompaniya statistika cache ni tozalash
   */
  async invalidateCompanyCache(companyId: string): Promise<void> {
    // Bu metod yangi hujjat/xabar qo'shilganda chaqirilishi mumkin
    // Hozircha oddiy implementation - keyingi versiyada pattern matching bilan
    this.logger.debug(`Invalidating cache for company: ${companyId}`);
    // cache-manager v5 da keys() metodi yo'q, shuning uchun
    // invalidation uchun TTL ga tayanamiz yoki Redis ishlatamiz
  }

  /**
   * O'rtacha javob vaqtini hisoblash (soatlarda)
   */
  private calculateAvgResponseHours(
    docs: Array<{ createdAt: Date; approvedAt: Date | null }>,
  ): number {
    const validDocs = docs.filter((doc) => doc.approvedAt !== null);
    if (validDocs.length === 0) return 0;

    const totalMs = validDocs.reduce((sum, doc) => {
      return sum + (doc.approvedAt!.getTime() - doc.createdAt.getTime());
    }, 0);

    const avgHours = totalMs / validDocs.length / (1000 * 60 * 60);
    return Number(avgHours.toFixed(1));
  }
}
