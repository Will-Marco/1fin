import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DevicePlatform } from '../../../../generated/prisma/client';

export class RegisterDeviceTokenDto {
  @ApiProperty({
    example: '11e5c1e2-2f4b-4db1-9351-0139a0b2a193',
    description: 'OneSignal player/subscription ID',
  })
  @IsString()
  @IsNotEmpty()
  playerId: string;

  @ApiProperty({
    enum: DevicePlatform,
    example: DevicePlatform.WEB,
    description: 'Device platform',
  })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}
