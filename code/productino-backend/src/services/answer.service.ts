import { BadRequestException, Injectable } from '@nestjs/common';
import { BeliefStatus, QuestionStatus, SourceKind } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { Question, User } from '../entities';
import { BeliefNodeRepository, QuestionRepository, SourceRepository } from '../repository';
import { MapAnswersSchema, StructuredLlmService } from '../llm';
import { ProjectService } from './project.service';
import { ExtractionService } from './extraction.service';
import { CoverageService } from './coverage.service';

@Injectable()
export class AnswerService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly sourceRepository: SourceRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly beliefNodeRepository: BeliefNodeRepository,
    private readonly llmService: StructuredLlmService,
    private readonly extractionService: ExtractionService,
    private readonly coverageService: CoverageService,
  ) {}

  async processAnswersText(projectId: number, user: User, answersText: string): Promise<void> {
    const project = await this.projectService.getProjectForUser(projectId, user);
    const replyText = (answersText ?? '').trim();
    if (!replyText) throw new BadRequestException('No answers provided');

    const allQuestions = await this.questionRepository.findAllForProject(projectId);
    const openQuestions = allQuestions.filter(
      (question) =>
        question.status === QuestionStatus.OPEN || question.status === QuestionStatus.INCLUDED,
    );

    const openIds = new Set(openQuestions.map((question) => question.id));
    const mappedQandA = await this.llmService.run({
      promptKey: PromptKey.MAP_ANSWERS,
      vars: { questions: this.questionsList(openQuestions), answers: replyText },
      schema: MapAnswersSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: (value) => value.mapped.length,
      // Referential integrity: question ids must be real open questions. Only
      // repair if the model invented *every* id (a total miss), else just record it.
      validate: (value) => {
        const invalid = value.mapped.filter((m) => !openIds.has(m.questionId)).length;
        const metrics = { mapped: value.mapped.length, invalidQuestionRefs: invalid };
        if (invalid > 0 && invalid === value.mapped.length) {
          return {
            ok: false,
            metrics,
            repairMessage:
              'None of the questionId values match an open question. Use only the exact ' +
              '[id N] numbers from the questions list above.',
          };
        }
        return { ok: true, metrics };
      },
    });

    // Apply mapped answers to their questions
    const openById = new Map(openQuestions.map((question) => [question.id, question]));
    const answered: Array<{ question: Question; answer: string }> = [];
    for (const mapped of mappedQandA.mapped) {
      const question = openById.get(mapped.questionId);
      if (!question) continue;
      await this.questionRepository.update(question.id, {
        status: QuestionStatus.ANSWERED,
        answerText: mapped.answer,
      } as any);
      answered.push({ question, answer: mapped.answer });
    }

    // Record the new round's input as an ANSWERS source.
    const nextRound =
      (await this.sourceRepository.findAllForProject(projectId)).reduce(
        (maxRound, source) => Math.max(maxRound, source.round),
        0,
      ) + 1;
    const source = await this.sourceRepository.create({
      project: { connect: { id: projectId } },
      kind: SourceKind.ANSWERS,
      label: `Client answers — round ${nextRound}`,
      content: this.buildSourceContent(replyText, answered, mappedQandA.notes, nextRound),
      round: nextRound,
    } as any);

    // Re-extract beliefs from the client's reply. Only those actually grounded in
    // the reply are CONFIRMED (the client stated them); an ungrounded or unsourced
    // belief stays soft — extraction already downgraded it. This stops a
    // hallucinated belief from being promoted to a committed answer.
    const extracted = await this.extractionService.run(projectId, user, source.id);
    const groundedIds = extracted
      .filter((node) => (node.provenance ?? []).some((entry) => entry.grounded))
      .map((node) => node.id);
    if (groundedIds.length) {
      await this.beliefNodeRepository.updateMany(
        { projectId, round: nextRound, id: { in: groundedIds } } as any,
        { status: BeliefStatus.CONFIRMED } as any,
      );
    }

    // Re-score: a fresh ProjectRound captures the (now higher) rollup.
    await this.coverageService.run(projectId, user);
  }

  private questionsList(openQuestions: Question[]): string {
    if (!openQuestions.length) return '(none outstanding)';
    return openQuestions
      .map(
        (question) =>
          `- [id ${question.id}] ${question.text}` +
          (question.assumedAnswer ? ` (assumed: ${question.assumedAnswer})` : ''),
      )
      .join('\n');
  }

  private buildSourceContent(
    raw: string,
    answered: Array<{ question: Question; answer: string }>,
    notes: string,
    round: number,
  ): string {
    const lines: string[] = [`CLIENT REPLY (round ${round}):`, raw, ''];
    if (answered.length) {
      lines.push('INTERPRETED AS ANSWERS TO OPEN QUESTIONS:');
      for (const entry of answered) lines.push(`Q: ${entry.question.text}\nA: ${entry.answer}`);
      lines.push('');
    }
    if (notes.trim()) lines.push(`ADDITIONAL NOTES FROM THE CLIENT:\n${notes.trim()}`);
    return lines.join('\n').trim();
  }
}
