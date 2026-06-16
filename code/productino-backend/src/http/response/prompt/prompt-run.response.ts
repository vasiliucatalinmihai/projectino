import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromptRun } from '../../../entities';

export class PromptRunResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  versionId: number;

  @ApiPropertyOptional({ nullable: true })
  success: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  latencyMs: number | null;

  @ApiPropertyOptional({ nullable: true })
  tokensIn: number | null;

  @ApiPropertyOptional({ nullable: true })
  tokensOut: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Provider that served the run' })
  provider: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Model that served the run' })
  model: string | null;

  @ApiPropertyOptional({ nullable: true })
  score: number | null;

  @ApiPropertyOptional({ nullable: true })
  subjectType: string | null;

  @ApiPropertyOptional({ nullable: true })
  subjectId: number | null;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: Partial<PromptRunResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(r: PromptRun): PromptRunResponse {
    return new PromptRunResponse({
      id: r.id,
      versionId: r.versionId,
      success: r.success,
      latencyMs: r.latencyMs,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      provider: r.provider,
      model: r.model,
      score: r.score,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      createdAt: r.createdAt,
    });
  }
}
