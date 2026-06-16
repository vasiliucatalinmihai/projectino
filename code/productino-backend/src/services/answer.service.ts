import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BeliefStatus, QuestionStatus, SourceKind } from '@prisma/client';
import { PromptKey, RenderedPrompt } from '../common/prompt-key';
import { Question, Source, User } from '../entities';
import {
  BeliefNodeRepository,
  QuestionRepository,
  SourceRepository,
} from '../repository';
import { LlmNotConfiguredError, LlmProviderError, LlmRequest, LlmService } from '../llm';
import { ProjectService } from './project.service';
import { PromptManagerService } from './prompt-manager.service';
import { ExtractionService } from './extraction.service';
import { CoverageService } from './coverage.service';

/**
 * Phase 4 — the convergence loop. Ingest a client's free-text reply: map it onto
 * the open questions (LLM), store it as a new ANSWERS source for the next round,
 * re-extract beliefs from it (marked CONFIRMED — the client said them), then
 * re-score. The new ProjectRound makes the confidence delta visible.
 */
@Injectable()
export class AnswerService {
  constructor(
    private readonly projects: ProjectService,
    private readonly sources: SourceRepository,
    private readonly questions: QuestionRepository,
    private readonly nodes: BeliefNodeRepository,
    private readonly prompts: PromptManagerService,
    private readonly llm: LlmService,
    private readonly extraction: ExtractionService,
    private readonly coverage: CoverageService,
  ) {}

  /** Fold a client's reply into the graph and re-converge. Returns nothing; the caller refetches the graph. */
  async ingest(projectId: number, user: User, answersText: string): Promise<void> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const replyText = (answersText ?? '').trim();
    if (!replyText) throw new BadRequestException('No answers provided');

    const allQuestions = await this.questions.findAllForProject(projectId);
    const openQuestions = allQuestions.filter(
      (question) =>
        question.status === QuestionStatus.OPEN || question.status === QuestionStatus.INCLUDED,
    );

    const mapping = await this.mapAnswers(project.id, user.accountId, openQuestions, replyText);

    // Apply mapped answers to their questions.
    const openById = new Map(openQuestions.map((question) => [question.id, question]));
    const answered: Array<{ question: Question; answer: string }> = [];
    for (const mapped of mapping.mapped) {
      const questionId = Number(mapped?.questionId);
      const answer = this.toText(mapped?.answer).trim();
      const question = openById.get(questionId);
      if (!question || !answer) continue;
      await this.questions.update(questionId, {
        status: QuestionStatus.ANSWERED,
        answerText: answer,
      } as any);
      answered.push({ question, answer });
    }

    // Record the new round's input as an ANSWERS source.
    const nextRound =
      (await this.sources.findAllForProject(projectId)).reduce(
        (maxRound, source) => Math.max(maxRound, source.round),
        0,
      ) + 1;
    const source = await this.sources.create({
      project: { connect: { id: projectId } },
      kind: SourceKind.ANSWERS,
      label: `Client answers — round ${nextRound}`,
      content: this.buildSourceContent(replyText, answered, this.toText(mapping.notes), nextRound),
      round: nextRound,
    } as any);

    // Re-extract beliefs from the client's reply; they are CONFIRMED (the client
    // stated them), unlike inferences from the original briefing.
    await this.extraction.run(projectId, user, source.id);
    await this.nodes.updateMany(
      { projectId, round: nextRound },
      { status: BeliefStatus.CONFIRMED } as any,
    );

    // Re-score: a fresh ProjectRound captures the (now higher) rollup.
    await this.coverage.run(projectId, user);
  }

  // ── helpers ─────────────────────────────────────────────────────

  private async mapAnswers(
    projectId: number,
    accountId: number,
    openQuestions: Question[],
    answersText: string,
  ): Promise<{ mapped: any[]; notes: string }> {
    const rendered = this.prompts.get(PromptKey.MAP_ANSWERS, {
      questions: this.questionsList(openQuestions),
      answers: answersText,
    });
    const request: LlmRequest = {
      messages: [{ role: 'user', content: rendered.content }],
      json: true,
      maxTokens: rendered.config.maxTokens,
      temperature: rendered.config.temperature,
    };

    const startedAt = Date.now();
    let text: string;
    let provider: string;
    let model: string;
    let tokensIn: number | null;
    let tokensOut: number | null;
    try {
      const response = await this.llm.run(accountId, request);
      ({ text, provider, model } = response);
      ({ tokensIn, tokensOut } = response.usage);
    } catch (error) {
      await this.recordFailure(rendered, projectId, Date.now() - startedAt, error);
      if (error instanceof LlmNotConfiguredError) throw new UnprocessableEntityException(error.message);
      if (error instanceof LlmProviderError) throw new BadGatewayException(error.message);
      throw error;
    }
    const latencyMs = Date.now() - startedAt;

    let parsed: { mapped: any[]; notes: string };
    try {
      parsed = this.parse(text);
    } catch (error: any) {
      await this.recordFailure(rendered, projectId, latencyMs, error);
      throw new UnprocessableEntityException('Model did not return valid answer-mapping JSON');
    }

    await this.prompts.recordOutcome(
      rendered,
      {
        success: true,
        latencyMs,
        tokensIn: tokensIn ?? undefined,
        tokensOut: tokensOut ?? undefined,
        provider,
        model,
        score: parsed.mapped.length,
      },
      { subjectType: 'project', subjectId: projectId },
    );
    return parsed;
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

  private parse(text: string): { mapped: any[]; notes: string } {
    let trimmed = (text ?? '').trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in output');
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    return {
      mapped: Array.isArray(parsed?.mapped) ? parsed.mapped : [],
      notes: this.toText(parsed?.notes),
    };
  }

  private toText(value: any): string {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }

  private async recordFailure(
    rendered: RenderedPrompt,
    projectId: number,
    latencyMs: number,
    error: any,
  ): Promise<void> {
    try {
      await this.prompts.recordOutcome(
        rendered,
        { success: false, latencyMs, meta: { error: error?.message ?? String(error) } },
        { subjectType: 'project', subjectId: projectId },
      );
    } catch {
      // Logging the outcome must never mask the original error.
    }
  }
}
