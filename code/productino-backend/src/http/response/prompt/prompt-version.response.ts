import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromptVersionStats {
  @ApiProperty({ example: 0 }) runs: number;
  @ApiPropertyOptional({ nullable: true, description: '0–100' }) successRate: number | null;
  @ApiPropertyOptional({ nullable: true }) avgScore: number | null;
  @ApiPropertyOptional({ nullable: true }) avgLatencyMs: number | null;
  @ApiPropertyOptional({ nullable: true }) avgTokensIn: number | null;
  @ApiPropertyOptional({ nullable: true }) avgTokensOut: number | null;
}

export class PromptVersionResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) version: number;
  @ApiProperty({ example: true }) isActive: boolean;
  @ApiProperty({ example: 'file' }) source: string;
  @ApiProperty({ type: Object }) config: Record<string, any>;
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: PromptVersionStats }) stats: PromptVersionStats;

  constructor(partial: Partial<PromptVersionResponse>) {
    Object.assign(this, partial);
  }
}
