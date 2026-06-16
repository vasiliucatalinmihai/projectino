import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConflictStatus } from '@prisma/client';
import { PromptKey, RenderedPrompt } from '../common/prompt-key';
import { BeliefNode, Conflict, User } from '../entities';
import { BeliefNodeRepository, ConflictRepository, ProjectRoundRepository } from '../repository';
import { LlmNotConfiguredError, LlmProviderError, LlmRequest, LlmService } from '../llm';
import { ProjectService } from './project.service';
import { PromptManagerService } from './prompt-manager.service';

/**
 * Phase 6: detect contradictions between beliefs and keep them as first-class
 * Conflict rows. Re-detecting replaces the set (conflicts are derived).
 */
@Injectable()
export class ConflictService {
  constructor(
    private readonly projects: ProjectService,
    private readonly nodes: BeliefNodeRepository,
    private readonly conflicts: ConflictRepository,
    private readonly rounds: ProjectRoundRepository,
    private readonly prompts: PromptManagerService,
    private readonly llm: LlmService,
  ) {}

  async detect(projectId: number, user: User): Promise<Conflict[]> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const nodes = await this.nodes.findAllForProject(projectId);

    // Always refresh: clear the previous set first.
    await this.conflicts.deleteMany({ projectId });
    if (nodes.length < 2) return [];

    const rendered = this.prompts.get(PromptKey.DETECT_CONFLICTS, {
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

    let parsed: any[];
    try {
      parsed = this.parse(text);
    } catch (error: any) {
      await this.recordFailure(rendered, project.id, latencyMs, error);
      throw new UnprocessableEntityException('Model did not return valid conflicts JSON');
    }

    const allRounds = await this.rounds.findAllForProject(projectId);
    const round = allRounds.length ? allRounds[allRounds.length - 1].index : 1;

    const created: Conflict[] = [];
    for (const conflict of parsed) {
      const summary = this.toText(conflict?.summary).trim() || 'Conflict';
      const detail = this.toText(conflict?.detail).trim();
      const beliefA = this.toText(conflict?.beliefA).trim();
      const beliefB = this.toText(conflict?.beliefB).trim();
      if (!beliefA || !beliefB || !detail) continue;
      created.push(
        await this.conflicts.create({
          project: { connect: { id: projectId } },
          summary: summary.slice(0, 200),
          detail,
          beliefA: beliefA.slice(0, 300),
          beliefB: beliefB.slice(0, 300),
          status: ConflictStatus.OPEN,
          round,
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

    return created;
  }

  /** Toggle a conflict's status (open ↔ resolved). */
  async setStatus(
    projectId: number,
    conflictId: number,
    user: User,
    status: ConflictStatus,
  ): Promise<Conflict> {
    await this.projects.findOne(projectId, user);
    const conflict = await this.conflicts.findById(conflictId);
    if (!conflict || conflict.projectId !== projectId) {
      throw new NotFoundException(`Conflict ${conflictId} not found`);
    }
    return this.conflicts.update(conflictId, { status } as any);
  }

  // ── helpers ─────────────────────────────────────────────────────

  private beliefsList(nodes: BeliefNode[]): string {
    return nodes
      .map(
        (node) =>
          `- [${node.status} ${Math.round(node.confidence * 100)}%] ${node.kind}: ${node.name}` +
          (node.description ? ` — ${node.description}` : ''),
      )
      .join('\n');
  }

  private parse(text: string): any[] {
    let trimmed = (text ?? '').trim();
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in output');
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!parsed || !Array.isArray(parsed.conflicts)) throw new Error('output missing conflicts[]');
    return parsed.conflicts.filter((conflict: any) => conflict && typeof conflict === 'object');
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
      // never mask the original error
    }
  }
}
