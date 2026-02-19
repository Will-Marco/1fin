import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  VOICE = 'VOICE',
  DOCUMENT = 'DOCUMENT',
}

export class CreateMessageDto {
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

  @ApiProperty({ enum: MessageType, default: MessageType.TEXT })
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType = MessageType.TEXT;

  @ApiPropertyOptional({ example: 'message-uuid', description: 'Reply qilish uchun xabar ID' })
  @IsString()
  @IsOptional()
  replyToId?: string;

  @ApiPropertyOptional({ example: 120, description: 'Ovozli xabar davomiyligi (sekundlarda)' })
  @IsInt()
  @Min(1)
  @Max(300) // 5 daqiqa
  @IsOptional()
  voiceDuration?: number;
}
