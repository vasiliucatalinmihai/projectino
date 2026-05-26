import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSettingRequest {
  @ApiProperty({ example: 'default_currency' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  key: string;

  @ApiProperty({ example: 'EUR' })
  @IsString()
  @MaxLength(2000)
  value: string;

  @ApiPropertyOptional({ example: 'Currency used in proposals & estimates' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
