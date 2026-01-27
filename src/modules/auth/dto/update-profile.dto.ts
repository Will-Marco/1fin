import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ali Valiyev' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsString()
  @IsOptional()
  phone?: string;
}
