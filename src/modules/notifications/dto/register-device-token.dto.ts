import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DevicePlatform } from '../../../../generated/prisma/client';

export class RegisterDeviceTokenDto {
  @ApiProperty({
    example: 'eXample_FCM_token_string',
    description: 'Firebase Cloud Messaging (FCM) device token',
  })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiProperty({
    enum: DevicePlatform,
    example: DevicePlatform.WEB,
    description: 'Device platform',
  })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}
