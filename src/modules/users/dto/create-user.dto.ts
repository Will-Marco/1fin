import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../../../generated/prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'operator01' })
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

  @ApiProperty({ enum: Role, example: Role.OPERATOR })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({
    example: 'worker-type-id',
    description: 'Required for OPERATOR and EMPLOYEE roles',
  })
  @IsString()
  @IsOptional()
  workerTypeId?: string;
}
