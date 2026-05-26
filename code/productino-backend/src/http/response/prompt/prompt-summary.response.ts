import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromptSummaryResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'gap-analysis' }) key: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Active version number' })
  activeVersion: number | null;
  @ApiProperty({ example: 1 }) versionCount: number;
  @ApiProperty({ example: 0 }) runCount: number;

  constructor(partial: Partial<PromptSummaryResponse>) {
    Object.assign(this, partial);
  }
}
