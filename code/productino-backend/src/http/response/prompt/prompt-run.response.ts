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

  static fromEntity(promptRun: PromptRun): PromptRunResponse {
    return new PromptRunResponse({
      id: promptRun.id,
      versionId: promptRun.versionId,
      success: promptRun.success,
      latencyMs: promptRun.latencyMs,
      tokensIn: promptRun.tokensIn,
      tokensOut: promptRun.tokensOut,
      provider: promptRun.provider,
      model: promptRun.model,
      score: promptRun.score,
      subjectType: promptRun.subjectType,
      subjectId: promptRun.subjectId,
      createdAt: promptRun.createdAt,
    });
  }
}
