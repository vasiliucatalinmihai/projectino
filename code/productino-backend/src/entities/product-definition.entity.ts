import { BaseEntity } from './base.entity';

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
