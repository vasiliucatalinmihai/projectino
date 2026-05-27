import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserRequest {
  @ApiProperty({ example: 'new.user@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'New User' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: 'changeme123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: ['VIEW_ONLY'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ description: 'Target account (super admin only; defaults to your account)' })
  @IsOptional()
  @IsInt()
  accountId?: number;
}
