import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateWorkerTypeDto {
  @ApiProperty({ example: 'Buxgalter' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
