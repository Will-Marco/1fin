import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { CompanyRole } from '../../../../generated/prisma/client';

export class UpdateMembershipDto {
  @ApiPropertyOptional({
    enum: CompanyRole,
    example: CompanyRole.CLIENT_EMPLOYEE,
    description: 'New role within the company',
  })
  @IsEnum(CompanyRole)
  @IsOptional()
  companyRole?: CompanyRole;

  @ApiPropertyOptional({
    type: [String],
    example: ['dept-id-1', 'dept-id-2'],
    description: 'Replaces all existing department access entries',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedDepartmentIds?: string[];
}
