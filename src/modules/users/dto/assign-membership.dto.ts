import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

export class AssignMembershipDto {
  @ApiProperty({ example: 'company-id-here' })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Rank (1-3) for CLIENT_EMPLOYEE and FIN_EMPLOYEE only',
  })
  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  rank?: number;

  @ApiProperty({
    type: [String],
    example: ['dept-id-1', 'dept-id-2'],
    description: 'Global department IDs the user can access',
  })
  @IsArray()
  @IsString({ each: true })
  allowedDepartmentIds: string[];
}
