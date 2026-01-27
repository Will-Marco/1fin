import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Tech Solutions LLC' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  inn?: string;

  @ApiPropertyOptional({ example: 'Tashkent, Chilanzar 10' })
  @IsString()
  @IsOptional()
  address?: string;
}
