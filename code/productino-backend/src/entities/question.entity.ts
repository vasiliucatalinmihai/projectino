import { QuestionImpact, QuestionStatus } from '@prisma/client';
import { BaseEntity } from './base.entity';

/**
 * A clarifying question with its proposed default answer. Proposed (OPEN),
 * curated in/out (INCLUDED/EXCLUDED), then ANSWERED once the client replies —
 * the answer is folded back into a new round.
 */
export class Question extends BaseEntity {
  id: number;
  projectId: number;
  coverageKey: string | null;
  text: string;
  assumedAnswer: string | null;
  impact: QuestionImpact;
  status: QuestionStatus;
  answerText: string | null;
  round: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Question>) {
    super(partial);
  }
}
