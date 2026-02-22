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

export class CreateClientUserDto {
  @ApiProperty({ example: 'company_director01' })
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

  @ApiProperty({
    enum: [
      SystemRole.CLIENT_FOUNDER,
      SystemRole.CLIENT_DIRECTOR,
      SystemRole.CLIENT_EMPLOYEE,
    ],
    example: SystemRole.CLIENT_EMPLOYEE,
    description: 'Role for client user',
  })
  @IsEnum(SystemRole)
  @IsNotEmpty()
  systemRole: SystemRole;
}
