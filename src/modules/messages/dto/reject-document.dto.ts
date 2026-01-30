import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RejectDocumentDto {
  @ApiProperty({ example: 'Hujjatda xatolik bor' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
