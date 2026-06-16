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
  @ApiProperty({
    description: 'Provider-specific options passed through on every call',
    example: { temperature: 0.2 },
    type: 'object',
    additionalProperties: true,
  })
  options: Record<string, any>;
  @ApiProperty({ example: true }) isActive: boolean;
  @ApiProperty({ example: true, description: 'Whether a credential is stored' }) hasKey: boolean;
  @ApiPropertyOptional({ example: '••••1234', nullable: true, description: 'Masked key hint' })
  keyHint: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  constructor(partial: Partial<AiModelResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(aiModel: AiModel): AiModelResponse {
    return new AiModelResponse({
      id: aiModel.id,
      accountId: aiModel.accountId,
      label: aiModel.label,
      provider: aiModel.provider,
      model: aiModel.model,
      baseUrl: aiModel.baseUrl,
      options: aiModel.options ?? {},
      isActive: aiModel.isActive,
      hasKey: aiModel.hasKey,
      keyHint: aiModel.keyHint,
      createdAt: aiModel.createdAt,
      updatedAt: aiModel.updatedAt,
    });
  }
}

/** What model the account would actually use when processing projects. */
export class EffectiveModelResponse {
  @ApiProperty({ enum: ['account', 'system'], example: 'system' })
  source: 'account' | 'system';

  @ApiPropertyOptional({ example: 'anthropic', nullable: true }) provider: string | null;
  @ApiPropertyOptional({ example: 'claude-opus-4-7', nullable: true }) model: string | null;

  @ApiProperty({
    example: true,
    description:
      'False when the resolved model (account or system default) is missing or has no credential',
  })
  configured: boolean;

  constructor(partial: Partial<EffectiveModelResponse>) {
    Object.assign(this, partial);
  }
}
