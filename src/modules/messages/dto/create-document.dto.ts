import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ example: 'company-cuid' })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({ example: 'dept-cuid' })
  @IsString()
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
