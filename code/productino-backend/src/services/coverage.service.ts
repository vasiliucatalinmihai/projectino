import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CoverageStatus, QuestionImpact, QuestionStatus } from '@prisma/client';
import { PromptKey, RenderedPrompt } from '../common/prompt-key';
import { RUBRIC, RUBRIC_KEYS, RUBRIC_PROMPT_LIST, WEIGHT_VALUE } from '../common/rubric';
import { BeliefNode, ProjectRound, User } from '../entities';
import {
  BeliefNodeRepository,
  CoverageAreaRepository,
  ProjectRoundRepository,
  QuestionRepository,
} from '../repository';
import { LlmNotConfiguredError, LlmProviderError, LlmRequest, LlmService } from '../llm';
import { ProjectService } from './project.service';
import { PromptManagerService } from './prompt-manager.service';
import { PipelineResetService } from './pipeline-reset.service';

/**
 * Phase 3 (the heart): score the belief graph against the rubric. The LLM judges
 * how complete each rubric category is and proposes clarifying questions; the
 * weighted project rollup (the "defined enough?" gate) is computed from the area
 * scores and snapshotted as a ProjectRound so convergence deltas can be shown.
 */
@Injectable()
export class CoverageService {
  constructor(
    private readonly projects: ProjectService,
    private readonly nodes: BeliefNodeRepository,
    private readonly coverage: CoverageAreaRepository,
    private readonly questions: QuestionRepository,
    private readonly rounds: ProjectRoundRepository,
    private readonly prompts: PromptManagerService,
    private readonly llm: LlmService,
    private readonly reset: PipelineResetService,
  ) {}

  /** The latest round's rollup confidence for a project (0 if never scored). */
  async run(projectId: number, user: User): Promise<ProjectRound> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const nodes = await this.nodes.findAllForProject(projectId);
    if (!nodes.length) {
      throw new BadRequestException('Extract beliefs before scoring coverage');
    }

    const rendered = this.prompts.get(PromptKey.SCORE_COVERAGE, {
      rubricList: RUBRIC_PROMPT_LIST,
      beliefsList: this.beliefsList(nodes),
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
      const response = await this.llm.run(user.accountId, request);
      ({ text, provider, model } = response);
      ({ tokensIn, tokensOut } = response.usage);
    } catch (error) {
      await this.recordFailure(rendered, project.id, Date.now() - startedAt, error);
      if (error instanceof LlmNotConfiguredError) throw new UnprocessableEntityException(error.message);
      if (error instanceof LlmProviderError) throw new BadGatewayException(error.message);
      throw error;
    }
    const latencyMs = Date.now() - startedAt;

    let parsed: { areas: any[]; questions: any[] };
    try {
      parsed = this.parse(text);
    } catch (error: any) {
      await this.recordFailure(rendered, project.id, latencyMs, error);
      throw new UnprocessableEntityException('Model did not return valid coverage JSON');
    }

    const nextIndex = (await this.rounds.findAllForProject(projectId)).length + 1;
    const areaByKey = new Map<string, any>(
      parsed.areas.map((area) => [String(area?.key ?? '').toLowerCase().trim(), area]),
    );

    // Upsert one CoverageArea per rubric category (always all of them, in order),
    // accumulating the weighted project rollup as we go.
    let weightedSum = 0;
    let weightTotal = 0;
    for (const area of RUBRIC) {
      const matchedArea = areaByKey.get(area.key) ?? {};
      const confidence = this.clamp01(matchedArea.rollupConfidence);
      const status = this.statusFor(confidence);
      const weight = WEIGHT_VALUE[area.weight];
      weightedSum += confidence * weight;
      weightTotal += weight;

      await this.coverage.upsert(
        { projectId_key: { projectId, key: area.key } },
        {
          project: { connect: { id: projectId } },
          key: area.key,
          name: area.name,
          weight: area.weight,
          rollupConfidence: confidence,
          status,
          round: nextIndex,
        } as any,
        { name: area.name, weight: area.weight, rollupConfidence: confidence, status, round: nextIndex } as any,
      );
    }
    const rollup = weightTotal ? Math.round((weightedSum / weightTotal) * 100) / 100 : 0;

    // Regenerate the question set, preserving anything already answered by a client.
    await this.questions.deleteMany({ projectId, status: { not: QuestionStatus.ANSWERED } });
    for (const question of parsed.questions) {
      const questionText = this.toText(question?.text).trim();
      if (!questionText) continue;
      await this.questions.create({
        project: { connect: { id: projectId } },
        coverageKey: this.coverageKeyOrNull(question?.coverageKey),
        text: questionText,
        assumedAnswer: this.toText(question?.assumedAnswer) || null,
        impact: this.impactOf(question?.impact),
        status: QuestionStatus.OPEN,
        round: nextIndex,
      } as any);
    }

    const round = await this.rounds.create({
      project: { connect: { id: projectId } },
      index: nextIndex,
      rollupConfidence: rollup,
    } as any);

    await this.prompts.recordOutcome(
      rendered,
      {
        success: true,
        latencyMs,
        tokensIn: tokensIn ?? undefined,
        tokensOut: tokensOut ?? undefined,
        provider,
        model,
        score: rollup,
      },
      { subjectType: 'project', subjectId: project.id },
    );

    // New coverage makes the PRD and everything built from it stale.
    await this.reset.afterScoring(projectId);

    return round;
  }

  // ── helpers ─────────────────────────────────────────────────────

  /** Belief nodes rendered as a category-grouped list for the prompt. */
  private beliefsList(nodes: BeliefNode[]): string {
    const nodesByCoverageKey = new Map<string, BeliefNode[]>();
    for (const node of nodes) {
      const key = node.coverageKey ?? 'uncategorized';
      const group = nodesByCoverageKey.get(key) ?? [];
      group.push(node);
      nodesByCoverageKey.set(key, group);
    }
    const formatNode = (node: BeliefNode) =>
      `  - [${node.status} ${Math.round(node.confidence * 100)}%] ${node.kind}: ${node.name}` +
      (node.description ? ` — ${node.description}` : '');

    const lines: string[] = [];
    for (const area of RUBRIC) {
      lines.push(`### ${area.key} — ${area.name}`);
      const areaNodes = nodesByCoverageKey.get(area.key) ?? [];
      lines.push(areaNodes.length ? areaNodes.map(formatNode).join('\n') : '  none');
    }
    const uncategorizedNodes = nodesByCoverageKey.get('uncategorized') ?? [];
    if (uncategorizedNodes.length) {
      lines.push('### uncategorized');
      lines.push(uncategorizedNodes.map(formatNode).join('\n'));
    }
    return lines.join('\n');
  }

  private parse(text: string): { areas: any[]; questions: any[] } {
    let trimmed = (text ?? '').trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in output');
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!parsed || (!Array.isArray(parsed.areas) && !Array.isArray(parsed.questions))) {
      throw new Error('output missing areas/questions');
    }
    return {
      areas: Array.isArray(parsed.areas) ? parsed.areas : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  }

  private clamp01(value: any): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    const scaled = numeric > 1 ? numeric / 100 : numeric; // tolerate a 0–100 scale
    return Math.max(0, Math.min(1, Math.round(scaled * 100) / 100));
  }

  private statusFor(confidence: number): CoverageStatus {
    if (confidence < 0.25) return CoverageStatus.UNDERDEFINED;
    if (confidence < 0.5) return CoverageStatus.THIN;
    if (confidence < 0.75) return CoverageStatus.ADEQUATE;
    return CoverageStatus.SOLID;
  }

  private impactOf(value: any): QuestionImpact {
    const upper = String(value ?? '').toUpperCase();
    return (Object.values(QuestionImpact) as string[]).includes(upper)
      ? (upper as QuestionImpact)
      : QuestionImpact.MEDIUM;
  }

  private coverageKeyOrNull(value: any): string | null {
    const key = this.toText(value).toLowerCase().trim();
    return RUBRIC_KEYS.includes(key) ? key : null;
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
