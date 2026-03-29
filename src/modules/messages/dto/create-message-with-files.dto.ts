import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateMessageWithFilesDto {
  @ApiProperty({ example: 'company-uuid' })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({ example: 'dept-uuid' })
  @IsString()
  @IsNotEmpty()
  globalDepartmentId: string;

  @ApiPropertyOptional({ example: 'Salom, hammaga!' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    example: 'message-uuid',
    description: 'Reply qilish uchun xabar ID',
  })
  @IsString()
  @IsOptional()
  replyToId?: string;

  @ApiPropertyOptional({
    example: 120,
    description: 'Ovozli xabar davomiyligi (sekundlarda)',
  })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @Max(300)
  @IsOptional()
  voiceDuration?: number;
}
