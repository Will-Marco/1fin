import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { SystemRole } from '../../../../generated/prisma/client';

export class CreateSystemUserDto {
  @ApiProperty({ example: 'fin_employee01' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'Ali Valiyev' })
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

  @ApiProperty({
    enum: SystemRole,
    example: SystemRole.FIN_EMPLOYEE,
    description: 'Role for 1FIN system user',
  })
  @IsEnum(SystemRole)
  @IsNotEmpty()
  systemRole: SystemRole;

  @ApiPropertyOptional({
    example: 1,
    description: 'UI display rank, no permission impact',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  rank?: number;
}
