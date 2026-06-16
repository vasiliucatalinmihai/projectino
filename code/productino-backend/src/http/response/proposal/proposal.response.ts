import { ApiProperty } from '@nestjs/swagger';
import { Proposal } from '../../../entities';

export class ProposalResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) projectId: number;
  @ApiProperty({ example: 1 }) version: number;
  @ApiProperty({ example: 'EUR' }) currency: string;
  @ApiProperty({ example: 600 }) dayRate: number;
  @ApiProperty({ example: 24000 }) totalLowCost: number;
  @ApiProperty({ example: 41000 }) totalHighCost: number;
  @ApiProperty({
    description: 'Full structured proposal: intro, phases[], assumptions, out_of_scope, totals, closing',
    type: 'object',
    additionalProperties: true,
  })
  content: Record<string, any>;
  @ApiProperty() createdAt: Date;

  constructor(partial: Partial<ProposalResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(proposal: Proposal): ProposalResponse {
    return new ProposalResponse({
      id: proposal.id,
      projectId: proposal.projectId,
      version: proposal.version,
      currency: proposal.currency,
      dayRate: proposal.dayRate,
      totalLowCost: proposal.totalLowCost,
      totalHighCost: proposal.totalHighCost,
      content: (proposal.content ?? {}) as Record<string, any>,
      createdAt: proposal.createdAt,
    });
  }
}

/** Client-facing proposal as markdown. */
export class ProposalDocResponse {
  @ApiProperty({ description: 'Client-facing proposal markdown' })
  markdown: string;

  constructor(markdown: string) {
    this.markdown = markdown;
  }
}
