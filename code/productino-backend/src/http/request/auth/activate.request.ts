import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ActivateRequest {
  @ApiProperty({ description: 'Activation token from the share link' })
  @IsString()
  @MinLength(8)
  token: string;

  @ApiProperty({ example: 'a-strong-password', description: 'New password (≥ 6 chars)' })
  @IsString()
  @MinLength(6)
  password: string;
}
