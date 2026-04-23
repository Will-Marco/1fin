import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

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

  @ApiPropertyOptional({ example: "Muhim hujjat, ko'rib chiqing" })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Chiquvchi xabar (true) yoki kiruvchi (false). Default: true',
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  isOutgoing?: boolean;
}
