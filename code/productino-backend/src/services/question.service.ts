import { Injectable, NotFoundException } from '@nestjs/common';
import { QuestionImpact, QuestionStatus } from '@prisma/client';
import { Question, User } from '../entities';
import { QuestionRepository } from '../repository';
import { ProjectService } from './project.service';

export interface CurateQuestionInput {
  status?: QuestionStatus;
  text?: string;
  assumedAnswer?: string | null;
}

const IMPACT_ORDER: Record<string, number> = {
  [QuestionImpact.HIGH]: 0,
  [QuestionImpact.MEDIUM]: 1,
  [QuestionImpact.LOW]: 2,
};

@Injectable()
export class QuestionService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly questionRepository: QuestionRepository,
  ) {}

  async update(projectId: number, questionId: number, user: User, input: CurateQuestionInput): Promise<Question> {
    await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    const question = await this.questionRepository.findById(questionId);
    if (!question || question.projectId !== projectId) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }
    const updates: any = {};
    if (input.status !== undefined) updates.status = input.status;
    if (input.text !== undefined) updates.text = input.text;
    if (input.assumedAnswer !== undefined) updates.assumedAnswer = input.assumedAnswer;
    return this.questionRepository.update(questionId, updates);
  }

  async buildClientDoc(projectId: number, user: User): Promise<string> {
    await this.projectService.getProjectForUser(projectId, user);
    const allQuestions = await this.questionRepository.findAllForProject(projectId);
    let chosen = allQuestions.filter((question) => question.status === QuestionStatus.INCLUDED);
    if (!chosen.length)
      chosen = allQuestions.filter((question) => question.status === QuestionStatus.OPEN);
    chosen.sort((a, b) => (IMPACT_ORDER[a.impact] ?? 3) - (IMPACT_ORDER[b.impact] ?? 3));

    const lines: string[] = [
      '# A few questions about your project',
      '',
      "To scope this accurately we'd like to confirm a few things. Where we've suggested an " +
        'assumption, just let us know if it works or correct it.',
      '',
    ];
    if (!chosen.length) {
      lines.push('_No open questions at the moment._');
    } else {
      chosen.forEach((question, index) => {
        lines.push(`${index + 1}. ${question.text}`);
        if (question.assumedAnswer) {
          lines.push(`   - _If we don't hear otherwise, we'll assume:_ ${question.assumedAnswer}`);
        }
        lines.push('');
      });
    }
    return lines.join('\n').trim() + '\n';
  }
}
