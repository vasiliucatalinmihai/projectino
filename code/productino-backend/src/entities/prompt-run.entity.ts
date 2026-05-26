import { BaseEntity } from './base.entity';

export class PromptRun extends BaseEntity {
  id: number;
  promptKey: string;
  versionId: number;
  experimentId: number | null;
  subjectType: string | null;
  subjectId: number | null;
  success: boolean | null;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  score: number | null;
  meta: Record<string, any> | null;
  createdAt: Date;

  constructor(partial: Partial<PromptRun>) {
    super(partial);
  }
}
