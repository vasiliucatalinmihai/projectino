import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProjectStage, QuestionStatus } from '@prisma/client';
import { PromptKey, RenderedPrompt } from '../common/prompt-key';
import { RUBRIC } from '../common/rubric';
import { BeliefNode, CoverageArea, ProductDefinition, Question, User } from '../entities';
import {
  BeliefNodeRepository,
  CoverageAreaRepository,
  ProductDefinitionRepository,
  ProjectRepository,
  ProjectRoundRepository,
  QuestionRepository,
} from '../repository';
import { LlmNotConfiguredError, LlmProviderError, LlmRequest, LlmService } from '../llm';
import { ProjectService } from './project.service';
import { PromptManagerService } from './prompt-manager.service';
import { PipelineResetService } from './pipeline-reset.service';

/** Minimum weighted rollup (0–1) to generate a PRD without an explicit override. */
export const DEFINITION_GATE = 0.7;

export interface GenerateDefinitionInput {
  override?: boolean;
  overrideReason?: string;
}

/**
 * Phase 5: project the confident Belief Graph into a versioned PRD. Gated on the
 * latest round's rollup — below the gate, generation requires an explicit
 * override (recorded on the definition).
 */
@Injectable()
export class DefinitionService {
  constructor(
    private readonly projects: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly nodes: BeliefNodeRepository,
    private readonly coverage: CoverageAreaRepository,
    private readonly questions: QuestionRepository,
    private readonly rounds: ProjectRoundRepository,
    private readonly definitions: ProductDefinitionRepository,
    private readonly prompts: PromptManagerService,
    private readonly llm: LlmService,
    private readonly reset: PipelineResetService,
  ) {}

  /** Latest PRD for a project (null if never generated). */
  async latest(projectId: number, user: User): Promise<ProductDefinition | null> {
    await this.projects.findOne(projectId, user);
    return this.definitions.findLatestForProject(projectId);
  }

  async generate(
    projectId: number,
    user: User,
    input: GenerateDefinitionInput = {},
  ): Promise<ProductDefinition> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy

    const allRounds = await this.rounds.findAllForProject(projectId);
    if (!allRounds.length) {
      throw new BadRequestException('Score coverage before generating a definition');
    }
    const rollupConfidence = allRounds[allRounds.length - 1].rollupConfidence;

    // The confidence gate: below it, require an explicit override.
    const belowGate = rollupConfidence < DEFINITION_GATE;
    if (belowGate && !input.override) {
      throw new UnprocessableEntityException({
        message:
          `Confidence ${Math.round(rollupConfidence * 100)}% is below the ` +
          `${Math.round(DEFINITION_GATE * 100)}% gate. Resolve more questions or override.`,
        gate: true,
        rollupConfidence: rollupConfidence,
        threshold: DEFINITION_GATE,
      });
    }

    const [nodes, areas, questions] = await Promise.all([
      this.nodes.findAllForProject(projectId),
      this.coverage.findAllForProject(projectId),
      this.questions.findAllForProject(projectId),
    ]);

    const rendered = this.prompts.get(PromptKey.SYNTHESIZE_PRD, {
      coverageList: this.coverageList(areas),
      beliefsList: this.beliefsList(nodes),
      answeredList: this.answeredList(questions),
    });
    const req: LlmRequest = {
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
      const result = await this.llm.run(user.accountId, req);
      ({ text, provider, model } = result);
      ({ tokensIn, tokensOut } = result.usage);
    } catch (error) {
      await this.recordFailure(rendered, project.id, Date.now() - startedAt, error);
      if (error instanceof LlmNotConfiguredError)
        throw new UnprocessableEntityException(error.message);
      if (error instanceof LlmProviderError) throw new BadGatewayException(error.message);
      throw error;
    }
    const latencyMs = Date.now() - startedAt;

    let content: Record<string, any>;
    try {
      content = this.parseJsonObject(text);
    } catch (error: any) {
      await this.recordFailure(rendered, project.id, latencyMs, error);
      throw new UnprocessableEntityException('Model did not return valid PRD JSON');
    }

    const version = (await this.definitions.countForProject(projectId)) + 1;
    const saved = await this.definitions.create({
      project: { connect: { id: projectId } },
      version,
      content,
      confidenceAtGeneration: rollupConfidence,
      gateOverride: belowGate && !!input.override,
      overrideReason: belowGate && input.override ? (input.overrideReason ?? null) : null,
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
        score: rollupConfidence,
      },
      { subjectType: 'project', subjectId: project.id },
    );

    // Move into DEFINITION (don't regress later stages).
    if (
      project.stage === ProjectStage.BRIEFING ||
      project.stage === ProjectStage.GAP_ANALYSIS ||
      project.stage === ProjectStage.AWAITING_CLIENT
    ) {
      await this.projectRepo.update(project.id, { stage: ProjectStage.DEFINITION } as any);
    }

    // A new PRD makes any existing delivery plan and proposal stale.
    await this.reset.afterDefinition(project.id);

    return saved;
  }

  // ── helpers ─────────────────────────────────────────────────────

  private coverageList(areas: CoverageArea[]): string {
    const areasByKey = new Map(areas.map((area) => [area.key, area]));
    return RUBRIC.map((rubricEntry) => {
      const area = areasByKey.get(rubricEntry.key);
      const pct = area ? Math.round(area.rollupConfidence * 100) : 0;
      return `- ${rubricEntry.name}: ${pct}% (${area?.status ?? 'UNDERDEFINED'})`;
    }).join('\n');
  }

  private beliefsList(nodes: BeliefNode[]): string {
    if (!nodes.length) return '(none)';
    const nodesByKey = new Map<string, BeliefNode[]>();
    for (const node of nodes) {
      const key = node.coverageKey ?? 'uncategorized';
      const group = nodesByKey.get(key) ?? [];
      group.push(node);
      nodesByKey.set(key, group);
    }
    const formatNode = (node: BeliefNode) =>
      `  - [${node.status} ${Math.round(node.confidence * 100)}%] ${node.kind}: ${node.name}` +
      (node.description ? ` — ${node.description}` : '');
    const lines: string[] = [];
    for (const area of RUBRIC) {
      const areaNodes = nodesByKey.get(area.key);
      if (!areaNodes?.length) continue;
      lines.push(`### ${area.name}`);
      lines.push(areaNodes.map(formatNode).join('\n'));
    }
    const uncategorizedNodes = nodesByKey.get('uncategorized');
    if (uncategorizedNodes?.length) {
      lines.push('### uncategorized');
      lines.push(uncategorizedNodes.map(formatNode).join('\n'));
    }
    return lines.join('\n');
  }

  private answeredList(questions: Question[]): string {
    const answered = questions.filter(
      (question) => question.status === QuestionStatus.ANSWERED && question.answerText,
    );
    if (!answered.length) return '(no client answers yet)';
    return answered
      .map((question) => `- Q: ${question.text}\n  A: ${question.answerText}`)
      .join('\n');
  }

  private parseJsonObject(text: string): Record<string, any> {
    let trimmed = (text ?? '').trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in output');
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || !parsed.summary)
      throw new Error('PRD missing summary');
    return this.normalize(parsed);
  }

  /** Coerce list fields to string[] and stories/risks to clean objects (models
   *  sometimes return a string where an array is expected). */
  private normalize(parsed: any): Record<string, any> {
    return {
      ...parsed,
      summary: this.toText(parsed.summary),
      in_scope: this.toStringList(parsed.in_scope),
      out_of_scope: this.toStringList(parsed.out_of_scope),
      non_functional: this.toStringList(parsed.non_functional),
      assumptions: this.toStringList(parsed.assumptions),
      user_stories: (Array.isArray(parsed.user_stories) ? parsed.user_stories : [])
        .filter((userStory: any) => userStory && typeof userStory === 'object' && userStory.story)
        .map((userStory: any) => ({
          role: this.toText(userStory.role),
          story: this.toText(userStory.story),
          acceptance_criteria: this.toStringList(userStory.acceptance_criteria),
        })),
      risks: (Array.isArray(parsed.risks) ? parsed.risks : [])
        .filter((risk: any) => risk && typeof risk === 'object' && risk.description)
        .map((risk: any) => ({
          description: this.toText(risk.description),
          severity: ['high', 'medium', 'low'].includes(String(risk.severity).toLowerCase())
            ? String(risk.severity).toLowerCase()
            : 'medium',
          mitigation: this.toText(risk.mitigation),
        })),
    };
  }

  private toStringList(value: any): string[] {
    if (Array.isArray(value)) return value.map((item) => this.toText(item)).filter(Boolean);
    const text = this.toText(value).trim();
    if (!text) return [];
    const parts = text.split(/\n+|[;•]\s*/).map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [text];
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
