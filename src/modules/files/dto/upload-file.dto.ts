import { IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;
}
