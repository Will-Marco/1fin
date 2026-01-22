import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+998[0-9]{9}$/, {
    message: 'Phone must be a valid Uzbekistan phone number (+998XXXXXXXXX)',
  })
  phone: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    example: 'iPhone 15 Pro',
    description: 'Device name for session tracking',
  })
  @IsString()
  @IsNotEmpty()
  deviceName: string;

  @ApiProperty({
    example: 'mobile',
    description: 'Device type: mobile, desktop, tablet',
  })
  @IsString()
  @IsNotEmpty()
  deviceType: string;
}
