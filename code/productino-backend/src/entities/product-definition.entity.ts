import { BaseEntity } from './base.entity';

/** The structured PRD content projected from the graph. */
export interface DefinitionContent {
  summary?: string;
  in_scope?: string[];
  out_of_scope?: string[];
  user_stories?: Array<{ role?: string; story: string; acceptance_criteria?: string[] }>;
  non_functional?: string[];
  assumptions?: string[];
  risks?: Array<{ description: string; severity?: string; mitigation?: string }>;
  [key: string]: any;
}

/**
 * PRESENTATION layer: a versioned PRD projected from the Belief Graph. Carries
 * the rollup it was generated at and whether the confidence gate was overridden.
 */
export class ProductDefinition extends BaseEntity {
  id: number;
  projectId: number;
  version: number;
  content: DefinitionContent;
  confidenceAtGeneration: number;
  gateOverride: boolean;
  overrideReason: string | null;
  createdAt: Date;

  constructor(partial: Partial<ProductDefinition>) {
    super(partial);
  }
}
