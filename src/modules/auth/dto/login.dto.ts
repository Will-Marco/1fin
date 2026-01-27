import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin01' })
  @IsString()
  @IsNotEmpty()
  username: string;

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
