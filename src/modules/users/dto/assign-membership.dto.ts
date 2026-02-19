import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsString,
} from 'class-validator';
import { CompanyRole } from '../../../../generated/prisma/client';

export class AssignMembershipDto {
  @ApiProperty({ example: 'company-id-here' })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({
    enum: CompanyRole,
    example: CompanyRole.CLIENT_DIRECTOR,
    description: 'Role within the company',
  })
  @IsEnum(CompanyRole)
  @IsNotEmpty()
  companyRole: CompanyRole;

  @ApiProperty({
    type: [String],
    example: ['dept-id-1', 'dept-id-2'],
    description: 'Global department IDs the user can access',
  })
  @IsArray()
  @IsString({ each: true })
  allowedDepartmentIds: string[];
}
