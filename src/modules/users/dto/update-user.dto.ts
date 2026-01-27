import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Ali Valiyev' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'worker-type-id' })
  @IsString()
  @IsOptional()
  workerTypeId?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
