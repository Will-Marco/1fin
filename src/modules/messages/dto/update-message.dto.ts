import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateMessageDto {
  @ApiProperty({ example: 'Yangilangan matn' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
