import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MinLength,
} from 'class-validator';
import { SystemRole } from '../../../../generated/prisma/client';

export class CreateSystemUserDto {
  @ApiProperty({ example: 'fin_employee01' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiPropertyOptional({
    example: 'SecurePass123',
    description: 'Password (optional, defaults to env DEFAULT_USER_PASSWORD)',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  @IsOptional()
  password?: string;

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
    description: 'Role for 1FIN system user (FIN_DIRECTOR, FIN_ADMIN, FIN_EMPLOYEE)',
  })
  @IsEnum(SystemRole)
  @IsNotEmpty()
  systemRole: SystemRole;
}
