import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Example LLC' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'IT xizmatlari va dasturiy ta\'minot ishlab chiqarish',
  })
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
    example: {
      name: 'Example LLC',
      account: '20208000000000000001',
      bank: 'Example Bank',
      bankAddress: 'Tashkent, Example Street, 1',
      mfo: '00000',
      inn: '000000000',
      director: 'Example Director',
    },
    description: 'Kompaniya rekvizitlari (JSON)',
  })
  @IsObject()
  @IsOptional()
  requisites?: Record<string, any>;
}
