import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ForwardMessageDto {
  @ApiProperty({
    example: 'dept-uuid',
    description: 'Forward qilinadigan target department ID',
  })
  @IsString()
  @IsNotEmpty()
  toDepartmentId: string;

  @ApiProperty({
    example: 'company-uuid',
    description: 'Company ID (bir company ichida forward)',
  })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiPropertyOptional({ example: 'Muhim hujjat, ko\'rib chiqing' })
  @IsString()
  @IsOptional()
  note?: string;
}
