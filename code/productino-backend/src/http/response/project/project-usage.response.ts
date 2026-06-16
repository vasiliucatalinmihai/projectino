import { ApiProperty } from '@nestjs/swagger';
import { ProjectTokenUsage } from '../../../services/project.service';

class PromptUsageResponse {
  @ApiProperty({ example: 'extract-beliefs' }) promptKey: string;
  @ApiProperty({ example: 4 }) runs: number;
  @ApiProperty({ example: 1820 }) tokensIn: number;
  @ApiProperty({ example: 640 }) tokensOut: number;
  @ApiProperty({ example: 2460 }) totalTokens: number;
}

/** LLM token usage for a project, summed from its prompt runs (+ per-stage breakdown). */
export class ProjectUsageResponse {
  @ApiProperty({ example: 12, description: 'Total LLM calls logged for this project' })
  runs: number;
  @ApiProperty({ example: 18450 }) tokensIn: number;
  @ApiProperty({ example: 7320 }) tokensOut: number;
  @ApiProperty({ example: 25770 }) totalTokens: number;
  @ApiProperty({ type: [PromptUsageResponse], description: 'Per-prompt (pipeline stage) breakdown' })
  byPrompt: PromptUsageResponse[];

  constructor(usage: ProjectTokenUsage) {
    this.runs = usage.runs;
    this.tokensIn = usage.tokensIn;
    this.tokensOut = usage.tokensOut;
    this.totalTokens = usage.totalTokens;
    this.byPrompt = usage.byPrompt;
  }
}
