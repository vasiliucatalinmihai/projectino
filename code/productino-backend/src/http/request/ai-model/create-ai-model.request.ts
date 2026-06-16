import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAiModelRequest {
  @ApiPropertyOptional({ example: 'Primary Claude', description: 'Friendly label' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiProperty({ example: 'anthropic', description: 'Provider key (anthropic, openai, …)' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  provider: string;

  @ApiProperty({ example: 'claude-opus-4-7' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  model: string;

  @ApiPropertyOptional({ example: 'sk-ant-…', description: 'Provider API key/credential' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  apiKey?: string;

  @ApiPropertyOptional({ example: 'https://api.anthropic.com', description: 'Custom endpoint' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  baseUrl?: string;

  @ApiPropertyOptional({
    description: 'Provider-specific options passed through on every call',
    example: { temperature: 0.2 },
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, any>;

  @ApiPropertyOptional({ example: true, description: 'Make this the active model' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: 'Super admin only: account to create the model in (defaults to your own)',
  })
  @IsOptional()
  @IsInt()
  accountId?: number;
}
