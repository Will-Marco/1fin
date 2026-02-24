import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Example LLC' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'IT xizmatlari va dasturiy ta\'minot' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  inn?: string;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ example: 'Tashkent, Chilanzar 10' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: { bank: 'Example Bank', account: '20208000000000000001', mfo: '00000' },
  })
  @IsObject()
  @IsOptional()
  requisites?: Record<string, any>;

  @ApiPropertyOptional({
    example: { additionalBank: 'Second Bank', additionalAccount: '20208000000000000002' },
  })
  @IsObject()
  @IsOptional()
  requisites2?: Record<string, any>;
}
