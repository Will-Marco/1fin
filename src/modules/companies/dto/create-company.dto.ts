import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Tech Solutions LLC' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  inn?: string;

  @ApiPropertyOptional({ example: 'Tashkent, Chilanzar 10' })
  @IsString()
  @IsOptional()
  address?: string;
}
