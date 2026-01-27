import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignCompanyDto {
  @ApiProperty({ example: 'company-id' })
  @IsString()
  @IsNotEmpty()
  companyId: string;
}
