import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class CreateClientUserDto {
  @ApiProperty({ example: 'company_director01' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'Bobur Toshmatov' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'UI display rank, no permission impact',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  rank?: number;
}
