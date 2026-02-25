import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({
    example: 'dept-uuid',
    description: 'Global department ID (fayl qaysi bo\'limga tegishli)',
  })
  @IsOptional()
  @IsString()
  globalDepartmentId?: string;

  @ApiPropertyOptional({
    example: 'message-uuid',
    description: 'Message ID (fayl qaysi xabarga biriktirilgan)',
  })
  @IsOptional()
  @IsString()
  messageId?: string;

  @ApiPropertyOptional({
    example: 'document-uuid',
    description: 'Document ID (fayl qaysi hujjatga biriktirilgan)',
  })
  @IsOptional()
  @IsString()
  documentId?: string;
}
