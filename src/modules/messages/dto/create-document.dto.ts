import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ example: 'company-uuid' })
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({ example: 'dept-uuid' })
  @IsUUID()
  @IsNotEmpty()
  globalDepartmentId: string;

  @ApiProperty({ example: 'Shartnoma #123' })
  @IsString()
  @IsNotEmpty()
  documentName: string;

  @ApiProperty({ example: 'DOC-2024-001' })
  @IsString()
  @IsNotEmpty()
  documentNumber: string;
}
