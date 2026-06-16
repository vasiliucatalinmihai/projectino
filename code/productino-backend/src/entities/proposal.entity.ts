import { BaseEntity } from './base.entity';

/** A priced phase of the proposal (costs computed from the delivery plan). */
export interface ProposalPhase {
  name: string;
  narrative?: string;
  scope: string[];
  lowDays: number;
  highDays: number;
  lowCost: number;
  highCost: number;
}

export interface ProposalContent {
  intro?: string;
  closing?: string;
  currency: string;
  dayRate: number;
  bufferPct: number;
  phases: ProposalPhase[];
  assumptions: string[];
  outOfScope: string[];
  totalLowDays: number;
  totalHighDays: number;
  totalLowCost: number;
  totalHighCost: number;
  [key: string]: any;
}

/**
 * PRESENTATION layer: a versioned, client-facing priced proposal / SOW projected
 * from the delivery plan + PRD. Numbers are deterministic; prose is LLM-written.
 */
export class Proposal extends BaseEntity {
  id: number;
  projectId: number;
  version: number;
  content: ProposalContent;
  currency: string;
  dayRate: number;
  totalLowCost: number;
  totalHighCost: number;
  createdAt: Date;

  constructor(partial: Partial<Proposal>) {
    super(partial);
  }
}
