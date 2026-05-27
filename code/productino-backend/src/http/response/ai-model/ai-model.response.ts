import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiModel } from '../../../entities';

export class AiModelResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) accountId: number;
  @ApiPropertyOptional({ example: 'Primary Claude', nullable: true }) label: string | null;
  @ApiProperty({ example: 'anthropic' }) provider: string;
  @ApiProperty({ example: 'claude-opus-4-7' }) model: string;
  @ApiPropertyOptional({ example: 'https://api.anthropic.com', nullable: true })
  baseUrl: string | null;
  @ApiProperty({ example: true }) isActive: boolean;
  @ApiProperty({ example: true, description: 'Whether a credential is stored' }) hasKey: boolean;
  @ApiPropertyOptional({ example: '••••1234', nullable: true, description: 'Masked key hint' })
  keyHint: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  constructor(partial: Partial<AiModelResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(m: AiModel): AiModelResponse {
    return new AiModelResponse({
      id: m.id,
      accountId: m.accountId,
      label: m.label,
      provider: m.provider,
      model: m.model,
      baseUrl: m.baseUrl,
      isActive: m.isActive,
      hasKey: m.hasKey,
      keyHint: m.keyHint,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    });
  }
}

/** What model the account would actually use when processing projects. */
export class EffectiveModelResponse {
  @ApiProperty({ enum: ['account', 'platform'], example: 'platform' })
  source: 'account' | 'platform';

  @ApiPropertyOptional({ example: 'anthropic', nullable: true }) provider: string | null;
  @ApiPropertyOptional({ example: 'claude-opus-4-7', nullable: true }) model: string | null;

  @ApiProperty({
    example: true,
    description: 'False when BYO is on but no active account model is configured',
  })
  configured: boolean;

  constructor(partial: Partial<EffectiveModelResponse>) {
    Object.assign(this, partial);
  }
}
