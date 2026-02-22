import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateMembershipDto {
  @ApiPropertyOptional({
    example: 2,
    description: 'Rank (1-3) for CLIENT_EMPLOYEE and FIN_EMPLOYEE only',
  })
  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  rank?: number;

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
