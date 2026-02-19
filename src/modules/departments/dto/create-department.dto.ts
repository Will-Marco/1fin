import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGlobalDepartmentDto {
  @ApiProperty({ example: "Bank to'lovlari" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'bank-payment',
    description: 'URL-friendly slug. Auto-generated from name if not provided.',
  })
  @IsString()
  @IsOptional()
  slug?: string;
}

export class UpdateGlobalDepartmentDto {
  @ApiPropertyOptional({ example: "Bank to'lovlari (yangilangan)" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'bank-payment-v2' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
