import { QuestionImpact, QuestionStatus } from '@prisma/client';
import { BaseEntity } from './base.entity';

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
