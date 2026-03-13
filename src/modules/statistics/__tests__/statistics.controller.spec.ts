import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemRole } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { StatisticsPeriod } from '../dto/get-statistics.dto';
import { StatisticsController } from '../statistics.controller';
import { StatisticsService } from '../statistics.service';

describe('StatisticsController', () => {
  let controller: StatisticsController;

  const mockStatisticsService = {
    getStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [
        {
          provide: StatisticsService,
          useValue: mockStatisticsService,
        },
        {
          provide: PrismaService,
          useValue: {
            userCompanyMembership: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<StatisticsController>(StatisticsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatistics', () => {
    it('should call service for system staff without modifying companyId', async () => {
      const dto = { period: StatisticsPeriod.MONTHLY };
      const user = {
        id: 'admin-user-id',
        systemRole: SystemRole.FIN_ADMIN,
      };
      const expectedResult = { documents: { total: 10 } };

      mockStatisticsService.getStatistics.mockResolvedValue(expectedResult as any);

      const result = await controller.getStatistics(dto, user);

      expect(mockStatisticsService.getStatistics).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });

    it('should auto-assign companyId for client roles without companyId', async () => {
      const dto = { period: StatisticsPeriod.MONTHLY };
      const user = {
        id: 'client-user-id',
        systemRole: SystemRole.CLIENT_DIRECTOR,
        memberships: [{ companyId: 'user_company_1', isActive: true }],
      };
      const expectedResult = { documents: { total: 5 } };

      mockStatisticsService.getStatistics.mockResolvedValue(expectedResult as any);

      const result = await controller.getStatistics(dto, user);

      expect(mockStatisticsService.getStatistics).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'user_company_1' }),
      );
      expect(result).toEqual(expectedResult);
    });

    it('should allow client to access their own company', async () => {
      const dto = { period: StatisticsPeriod.MONTHLY, companyId: 'user_company_1' };
      const user = {
        id: 'client-user-id',
        systemRole: SystemRole.CLIENT_DIRECTOR,
        memberships: [{ companyId: 'user_company_1', isActive: true }],
      };
      const expectedResult = { documents: { total: 5 } };

      mockStatisticsService.getStatistics.mockResolvedValue(expectedResult as any);

      const result = await controller.getStatistics(dto, user);

      expect(mockStatisticsService.getStatistics).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw error for client without any membership', async () => {
      const dto = { period: StatisticsPeriod.MONTHLY };
      const user = {
        id: 'client-user-id',
        systemRole: SystemRole.CLIENT_DIRECTOR,
        memberships: [],
      };

      await expect(controller.getStatistics(dto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error for client accessing other company', async () => {
      const dto = { period: StatisticsPeriod.MONTHLY, companyId: 'other_company' };
      const user = {
        id: 'client-user-id',
        systemRole: SystemRole.CLIENT_DIRECTOR,
        memberships: [{ companyId: 'user_company_1', isActive: true }],
      };

      await expect(controller.getStatistics(dto, user)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
