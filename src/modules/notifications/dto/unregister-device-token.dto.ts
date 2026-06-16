import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UnregisterDeviceTokenDto {
  @ApiProperty({
    example: 'eXample_FCM_token_string',
    description:
      'Firebase Cloud Messaging (FCM) device token to deactivate. Sent in the ' +
      'body (not the URL) because FCM tokens may contain "/" and other ' +
      'characters that break path routing.',
  })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
