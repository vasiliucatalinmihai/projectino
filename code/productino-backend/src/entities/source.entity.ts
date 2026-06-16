import { SourceKind } from '@prisma/client';
import { BaseEntity } from './base.entity';

/**
 * EVIDENCE layer. Immutable raw input for a project — the initial briefing, a
 * transcript, an email, or a round of pasted client answers. Belief nodes trace
 * back to a Source via their provenance.
 */
export class Source extends BaseEntity {
  id: number;
  projectId: number;
  kind: SourceKind;
  label: string | null;
  content: string;
  round: number;
  createdAt: Date;

  constructor(partial: Partial<Source>) {
    super(partial);
  }
}
