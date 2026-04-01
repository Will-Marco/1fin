import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCompanyMemberDto {
  @ApiProperty({ example: 'cuid-user-id', description: 'User ID to attach' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Rank (1-3), only for employees',
  })
  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  rank?: number;

  @ApiPropertyOptional({
    example: ['dept-id-1', 'dept-id-2'],
    description:
      'Allowed global department IDs. Empty array = no department access.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedDepartmentIds?: string[];
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'Example LLC' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: "IT xizmatlari va dasturiy ta'minot ishlab chiqarish",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  inn?: string;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ example: 'Tashkent, Chilanzar 10' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: {
      name: 'Example LLC',
      account: '20208000000000000001',
      bank: 'Example Bank',
      bankAddress: 'Tashkent, Example Street, 1',
      mfo: '00000',
      inn: '000000000',
      director: 'Example Director',
    },
    description: 'Kompaniya rekvizitlari (JSON)',
  })
  @IsObject()
  @IsOptional()
  requisites?: Record<string, any>;

  @ApiPropertyOptional({
    example: {
      additionalBank: 'Second Bank',
      additionalAccount: '20208000000000000002',
    },
    description: "Kompaniya qo'shimcha rekvizitlari (JSON)",
  })
  @IsObject()
  @IsOptional()
  requisites2?: Record<string, any>;
  @ApiPropertyOptional({
    example: [
      { userId: 'cuid-user-1', rank: 1, allowedDepartmentIds: ['dept-id-1'] },
      { userId: 'cuid-user-2', allowedDepartmentIds: [] },
    ],
    description:
      'Optional list of existing users to attach to this company on creation. ' +
      'Users not found are skipped and reported in the response.',
    type: [CreateCompanyMemberDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCompanyMemberDto)
  @IsOptional()
  members?: CreateCompanyMemberDto[];
}
