import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ForwardMessageDto {
  @ApiProperty({ example: 'department-uuid', description: 'Forward qilinadigan department ID' })
  @IsString()
  @IsNotEmpty()
  toDepartmentId: string;

  @ApiPropertyOptional({ example: 'Qo\'shimcha izoh' })
  @IsString()
  @IsOptional()
  note?: string;
}
