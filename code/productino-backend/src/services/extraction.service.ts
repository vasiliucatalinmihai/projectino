import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BeliefNodeType, BeliefStatus, ProjectStage } from '@prisma/client';
import { PromptKey, RenderedPrompt } from '../common/prompt-key';
import { RUBRIC_KEYS, RUBRIC_PROMPT_LIST } from '../common/rubric';
import { BeliefNode, Provenance, Source, User } from '../entities';
import { BeliefNodeRepository, ProjectRepository, SourceRepository } from '../repository';
import { LlmNotConfiguredError, LlmProviderError, LlmRequest, LlmService } from '../llm';
import { ProjectService } from './project.service';
import { PromptManagerService } from './prompt-manager.service';
import { PipelineResetService } from './pipeline-reset.service';

const NODE_TYPES = new Set(Object.values(BeliefNodeType));
const STATUSES = new Set(Object.values(BeliefStatus));
const KINDS = new Set([
  'feature',
  'goal',
  'rule',
  'nfr',
  'integration',
  'data',
  'platform',
  'stakeholder',
]);

/**
 * Phase 2: turn a project Source into structured BeliefNodes (the Understanding
 * layer) via the account's configured LLM. Re-running for the same round
 * replaces that round's nodes, so extraction is idempotent per source round.
 */
@Injectable()
export class ExtractionService {
  constructor(
    private readonly projects: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly sources: SourceRepository,
    private readonly nodes: BeliefNodeRepository,
    private readonly prompts: PromptManagerService,
    private readonly llm: LlmService,
    private readonly reset: PipelineResetService,
  ) {}

  /**
   * Extract beliefs from a project source (defaults to the briefing) and persist
   * them. Returns the created nodes.
   */
  async run(projectId: number, user: User, sourceId?: number): Promise<BeliefNode[]> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const source = await this.resolveSource(projectId, sourceId);

    const rendered = this.prompts.get(PromptKey.EXTRACT_BELIEFS, {
      source: source.content,
      sourceKind: source.kind,
      rubricList: RUBRIC_PROMPT_LIST,
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

    let beliefs: any[];
    try {
      beliefs = this.parseBeliefs(text);
    } catch (error: any) {
      await this.recordFailure(rendered, project.id, latencyMs, error);
      throw new UnprocessableEntityException('Model did not return valid belief JSON');
    }

    // Idempotent per round: replace any nodes previously extracted for this round.
    await this.nodes.deleteMany({ projectId, round: source.round });

    const created: BeliefNode[] = [];
    for (const belief of beliefs) {
      created.push(
        await this.nodes.create({
          project: { connect: { id: project.id } },
          nodeType: this.toNodeType(belief.nodeType),
          kind: this.toKind(belief.kind),
          name: this.toText(belief.name).slice(0, 200),
          description: this.toText(belief.description) || null,
          status: this.toStatus(belief.status),
          confidence: this.clampConfidence(belief.confidence),
          coverageKey: this.toCoverageKey(belief.coverageKey),
          provenance: this.toProvenance(belief.quote, source),
          round: source.round,
        } as any),
      );
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
        score: created.length,
      },
      { subjectType: 'project', subjectId: project.id },
    );

    // First extraction moves the project into analysis; don't regress later stages.
    if (project.stage === ProjectStage.BRIEFING) {
      await this.projectRepo.update(project.id, { stage: ProjectStage.GAP_ANALYSIS } as any);
    }

    // New beliefs make coverage/questions/conflicts and the whole delivery chain
    // stale — clear them (rounds + answered questions are preserved).
    await this.reset.afterExtraction(project.id);

    return created;
  }

  // ── helpers ─────────────────────────────────────────────────────

  private async resolveSource(projectId: number, sourceId?: number): Promise<Source> {
    const source = sourceId
      ? await this.sources.findById(sourceId)
      : await this.sources.findBriefing(projectId);
    if (!source || source.projectId !== projectId) {
      throw new BadRequestException('No source to extract from');
    }
    if (!source.content?.trim()) {
      throw new BadRequestException('Source has no content to extract from');
    }
    return source;
  }

  /** Extract the JSON object from the model's text (tolerates fences / prose). */
  private parseBeliefs(text: string): any[] {
    let trimmed = (text ?? '').trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in output');
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!parsed || !Array.isArray(parsed.beliefs)) throw new Error('output missing beliefs[]');
    return parsed.beliefs.filter(
      (belief: any) => belief && typeof belief === 'object' && this.toText(belief.name).trim(),
    );
  }

  private toNodeType(value: any): BeliefNodeType {
    const upper = String(value ?? '').toUpperCase();
    return NODE_TYPES.has(upper as BeliefNodeType)
      ? (upper as BeliefNodeType)
      : BeliefNodeType.REQUIREMENT;
  }

  private toStatus(value: any): BeliefStatus {
    const upper = String(value ?? '').toUpperCase();
    // The model must never assert CONFIRMED; downgrade to STATED if it tries.
    if (upper === BeliefStatus.CONFIRMED) return BeliefStatus.STATED;
    return STATUSES.has(upper as BeliefStatus) ? (upper as BeliefStatus) : BeliefStatus.INFERRED;
  }

  private toKind(value: any): string {
    const kind = this.toText(value).toLowerCase().trim();
    return KINDS.has(kind) ? kind : 'feature';
  }

  private toCoverageKey(value: any): string | null {
    const key = this.toText(value).toLowerCase().trim();
    return RUBRIC_KEYS.includes(key) ? key : null;
  }

  private clampConfidence(value: any): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.5;
    // Tolerate a model that returns 0–100 instead of 0–1.
    const scaled = numeric > 1 ? numeric / 100 : numeric;
    return Math.max(0, Math.min(1, Math.round(scaled * 100) / 100));
  }

  /** Build provenance from the model's quote: locate it in the source for a real span. */
  private toProvenance(quote: any, source: Source): Provenance[] {
    const quoteText = this.toText(quote).trim();
    if (!quoteText) return [];
    const quoteIndex = source.content.indexOf(quoteText);
    const entry: Provenance = { sourceId: source.id, quote: quoteText };
    if (quoteIndex >= 0) entry.span = [quoteIndex, quoteIndex + quoteText.length];
    return [entry];
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
