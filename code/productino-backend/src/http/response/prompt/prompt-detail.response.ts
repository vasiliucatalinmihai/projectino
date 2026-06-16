import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromptVersionResponse } from './prompt-version.response';
import { PromptRunResponse } from './prompt-run.response';

export class PromptDetailResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'extract-beliefs' }) key: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({ nullable: true }) activeVersion: number | null;
  @ApiProperty({ type: [PromptVersionResponse] }) versions: PromptVersionResponse[];
  @ApiProperty({ type: [PromptRunResponse] }) recentRuns: PromptRunResponse[];

  constructor(partial: Partial<PromptDetailResponse>) {
    Object.assign(this, partial);
  }
}
