import { Prisma, ProjectStage, SourceKind } from '@prisma/client';
import { Account } from './account.entity';
import { BaseEntity } from './base.entity';
import { Client } from './client.entity';
import { Source } from './source.entity';

export class Project extends BaseEntity {
  id: number;
  accountId: number;
  account?: Account;
  clientId: number;
  client?: Client;
  name: string;
  stage: ProjectStage;
  // Optional per-project rubric override ({ enabled, overrides }); null → the
  // built-in default. Interpreted by RubricService — kept loosely typed here so
  // the entity stays decoupled from the service.
  rubric: Prisma.JsonValue | null;
  // Loaded when requested. The raw inputs of the Belief Graph; the initial
  // briefing is the BRIEFING source.
  sources?: Source[];
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Project>) {
    super(partial);
  }

  /** The initial briefing text, derived from the BRIEFING source if loaded. */
  get briefing(): string | null {
    const src = this.sources?.find((s) => s.kind === SourceKind.BRIEFING);
    return src?.content ?? null;
  }

  get hasBriefing(): boolean {
    const b = this.briefing;
    return !!b && b.trim().length > 0;
  }
}
