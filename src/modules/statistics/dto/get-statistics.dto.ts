import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export enum StatisticsPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

export class GetStatisticsDto {
  @ApiPropertyOptional({
    description: 'Kompaniya ID (Admin uchun ixtiyoriy, mijoz avtomatik oladi)',
    example: 'cuid-company-id',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Bo\'lim ID (ixtiyoriy)',
    example: 'cuid-department-id',
  })
  @IsOptional()
  @IsString()
  globalDepartmentId?: string;

  @ApiPropertyOptional({
    enum: StatisticsPeriod,
    default: StatisticsPeriod.MONTHLY,
    description: 'Statistika davri',
  })
  @IsOptional()
  @IsEnum(StatisticsPeriod)
  period?: StatisticsPeriod = StatisticsPeriod.MONTHLY;

  @ApiPropertyOptional({
    description: 'Boshlanish sanasi (YYYY-MM-DD formatda), faqat CUSTOM uchun',
    example: '2024-01-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from sanasi YYYY-MM-DD formatida bo\'lishi kerak',
  })
  from?: string;

  @ApiPropertyOptional({
    description: 'Tugash sanasi (YYYY-MM-DD formatda), faqat CUSTOM uchun',
    example: '2024-12-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to sanasi YYYY-MM-DD formatida bo\'lishi kerak',
  })
  to?: string;
}
