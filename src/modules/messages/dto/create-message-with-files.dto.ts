import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
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

  @ApiPropertyOptional({
    example: true,
    description:
      'Chiquvchi xabar (true) yoki kiruvchi (false). Faqat 1FIN xodimlari uchun.',
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  isOutgoing?: boolean;
}
