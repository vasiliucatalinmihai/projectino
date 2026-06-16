import { BeliefNodeType, BeliefStatus } from '@prisma/client';
import { BaseEntity } from './base.entity';

/** One provenance span: which Source, where in it, and the quoted fragment. */
export interface Provenance {
  sourceId: number;
  span?: [number, number];
  quote?: string;
  /** Whether the quote was actually found in the source (anti-hallucination). */
  grounded?: boolean;
  /** How the quote was located: exact / whitespace-normalized / fuzzy / not found. */
  match?: 'exact' | 'normalized' | 'fuzzy' | 'none';
}

/**
 * UNDERSTANDING layer. One polymorphic belief, wearing the epistemic envelope:
 * how sure we are (`confidence`), where it stands (`status`), and why
 * (`provenance`). `kind` sub-types a REQUIREMENT; `extra` holds type-specific
 * fields (e.g. risk severity/probability) without new columns.
 */
export class BeliefNode extends BaseEntity {
  id: number;
  projectId: number;
  nodeType: BeliefNodeType;
  // feature | goal | rule | nfr | integration | data | platform | stakeholder
  kind: string;
  name: string;
  description: string | null;
  status: BeliefStatus;
  confidence: number;
  coverageKey: string | null;
  provenance: Provenance[];
  round: number;
  extra: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<BeliefNode>) {
    super(partial);
  }
}
