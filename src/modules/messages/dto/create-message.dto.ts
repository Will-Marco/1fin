import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  VOICE = 'VOICE',
  DOCUMENT = 'DOCUMENT',
}

export class CreateMessageDto {
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

  @ApiPropertyOptional({ example: 'Shartnoma', description: 'Hujjat nomi (DOCUMENT type uchun)' })
  @IsString()
  @IsOptional()
  documentName?: string;

  @ApiPropertyOptional({ example: 'DOC-2024-001', description: 'Hujjat raqami (DOCUMENT type uchun)' })
  @IsString()
  @IsOptional()
  documentNumber?: string;
}
