import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DeliveryLevel, ProjectStage } from '@prisma/client';
import { PromptKey, RenderedPrompt } from '../common/prompt-key';
import { DeliveryItem, User } from '../entities';
import {
  DeliveryItemRepository,
  ProductDefinitionRepository,
  ProjectRepository,
} from '../repository';
import { LlmNotConfiguredError, LlmProviderError, LlmRequest, LlmService } from '../llm';
import { ProjectService } from './project.service';
import { PromptManagerService } from './prompt-manager.service';
import { PipelineResetService } from './pipeline-reset.service';

export interface DeliveryNode {
  id: number;
  level: DeliveryLevel;
  title: string;
  description: string | null;
  phase: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  totalLow: number;
  totalHigh: number;
  children: DeliveryNode[];
}
export interface DeliveryTree {
  epics: DeliveryNode[];
  totalLow: number;
  totalHigh: number;
}

interface PrdContext {
  summary: string;
  inScope: string;
  userStories: string;
  nonFunctional: string;
}

/**
 * Phase 7 — the delivery layer. Decompose the latest PRD into Epic → Story →
 * Task with ranged estimates and MVP/later phasing.
 *
 * Generation is split into shallow LLM calls so weaker models nest reliably:
 * one call lists the epics, then one call per epic produces its stories+tasks
 * (only two levels deep, scoped to that epic). The per-epic calls run in
 * parallel. Story/epic/project totals are rolled up from task estimates on read.
 */
@Injectable()
export class DeliveryService {
  constructor(
    private readonly projects: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly items: DeliveryItemRepository,
    private readonly definitions: ProductDefinitionRepository,
    private readonly prompts: PromptManagerService,
    private readonly llm: LlmService,
    private readonly reset: PipelineResetService,
  ) {}

  /** Nested epics→stories→tasks with rolled-up estimate ranges. */
  async tree(projectId: number, user: User): Promise<DeliveryTree> {
    await this.projects.findOne(projectId, user);
    const allItems = await this.items.findAllForProject(projectId);
    return this.buildTree(allItems);
  }

  async generate(projectId: number, user: User): Promise<DeliveryTree> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const def = await this.definitions.findLatestForProject(projectId);
    if (!def) {
      throw new BadRequestException('Generate a product definition before planning delivery');
    }
    const content = (def.content ?? {}) as Record<string, any>;
    const prd: PrdContext = {
      summary: this.toText(content.summary),
      inScope: this.toBulletList(content.in_scope),
      userStories: this.toStoryBulletList(content.user_stories),
      nonFunctional: this.toBulletList(content.non_functional),
    };

    // 1) Epics (flat — one shallow call).
    const epics = await this.generateEpics(project.id, user.accountId, prd);
    if (!epics.length) {
      throw new UnprocessableEntityException('Model did not return any epics');
    }

    // Regenerate: clear the old plan (children first to respect the self-FK).
    for (const level of [DeliveryLevel.TASK, DeliveryLevel.STORY, DeliveryLevel.EPIC]) {
      await this.items.deleteMany({ projectId, level });
    }

    // Create the epic rows first (so children can reference them).
    const epicRows: Array<{ row: DeliveryItem; epic: any }> = [];
    for (let epicIndex = 0; epicIndex < epics.length; epicIndex++) {
      const row = await this.items.create({
        project: { connect: { id: projectId } },
        level: DeliveryLevel.EPIC,
        title: this.toText(epics[epicIndex]?.title).slice(0, 200) || `Epic ${epicIndex + 1}`,
        description: this.toText(epics[epicIndex]?.description) || null,
        orderIndex: epicIndex,
      } as any);
      epicRows.push({ row, epic: epics[epicIndex] });
    }

    // 2) Stories + tasks per epic, in parallel. A failed epic plan is skipped,
    //    not fatal, so one flaky call doesn't lose the whole plan.
    await Promise.all(
      epicRows.map(({ row, epic }) =>
        this.planEpic(project.id, user.accountId, prd, row, epic).catch(() => undefined),
      ),
    );

    // Move into PLANNING (don't regress DELIVERY).
    if (project.stage !== ProjectStage.DELIVERY) {
      await this.projectRepo.update(project.id, { stage: ProjectStage.PLANNING } as any);
    }

    // A regenerated plan makes any existing proposal stale.
    await this.reset.afterDelivery(project.id);

    return this.buildTree(await this.items.findAllForProject(projectId));
  }

  // ── generation steps ────────────────────────────────────────────

  private async generateEpics(
    projectId: number,
    accountId: number,
    prd: PrdContext,
  ): Promise<any[]> {
    const parsed = await this.callJson(PromptKey.GENERATE_EPICS, accountId, projectId, {
      summary: prd.summary,
      inScope: prd.inScope,
      userStories: prd.userStories,
    });
    const epics = Array.isArray(parsed?.epics) ? parsed.epics : [];
    return epics.filter(
      (epic: any) => epic && typeof epic === 'object' && this.toText(epic.title).trim(),
    );
  }

  /** Generate one epic's stories+tasks and persist them under the epic row. */
  private async planEpic(
    projectId: number,
    accountId: number,
    prd: PrdContext,
    epicRow: DeliveryItem,
    epic: any,
  ): Promise<void> {
    const parsed = await this.callJson(PromptKey.GENERATE_EPIC_PLAN, accountId, projectId, {
      summary: prd.summary,
      nonFunctional: prd.nonFunctional,
      epicTitle: this.toText(epic?.title),
      epicDescription: this.toText(epic?.description),
    });
    const stories = this.normalizeStories(parsed);

    let storyIndex = 0;
    for (const story of stories) {
      const storyRow = await this.items.create({
        project: { connect: { id: projectId } },
        parent: { connect: { id: epicRow.id } },
        level: DeliveryLevel.STORY,
        title: this.toText(story?.title).slice(0, 200) || `Story ${storyIndex + 1}`,
        description: this.toText(story?.description) || null,
        orderIndex: storyIndex++,
      } as any);

      let taskIndex = 0;
      for (const task of Array.isArray(story?.tasks) ? story.tasks : []) {
        const [low, high] = this.estimateRange(task?.estimateLow, task?.estimateHigh);
        await this.items.create({
          project: { connect: { id: projectId } },
          parent: { connect: { id: storyRow.id } },
          level: DeliveryLevel.TASK,
          title: this.toText(task?.title).slice(0, 200) || `Task ${taskIndex + 1}`,
          description: this.toText(task?.description) || null,
          estimateLow: low,
          estimateHigh: high,
          phase: this.toPhase(task?.phase),
          orderIndex: taskIndex++,
        } as any);
      }
    }
  }

  /** Render → run → tolerant-parse to an object, recording the prompt outcome. */
  private async callJson(
    key: PromptKey,
    accountId: number,
    projectId: number,
    vars: Record<string, any>,
  ): Promise<Record<string, any>> {
    const rendered = this.prompts.get(key, vars);
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
      const result = await this.llm.run(accountId, req);
      ({ text, provider, model } = result);
      ({ tokensIn, tokensOut } = result.usage);
    } catch (error) {
      await this.recordFailure(rendered, projectId, Date.now() - startedAt, error);
      if (error instanceof LlmNotConfiguredError)
        throw new UnprocessableEntityException(error.message);
      if (error instanceof LlmProviderError) throw new BadGatewayException(error.message);
      throw error;
    }
    const latencyMs = Date.now() - startedAt;

    let parsed: Record<string, any>;
    try {
      parsed = this.parseJsonObject(text);
    } catch (error: any) {
      await this.recordFailure(rendered, projectId, latencyMs, error);
      throw new UnprocessableEntityException('Model did not return valid delivery JSON');
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
      },
      { subjectType: 'project', subjectId: projectId },
    );
    return parsed;
  }

  // ── helpers ─────────────────────────────────────────────────────

  /** Coerce a per-epic plan into stories[] with tasks[] (tolerant of weak nesting). */
  private normalizeStories(parsed: Record<string, any>): any[] {
    const hasEstimate = (item: any) => item?.estimateLow != null || item?.estimateHigh != null;
    const asTask = (item: any) => ({
      title: item?.title,
      description: item?.description,
      estimateLow: item?.estimateLow,
      estimateHigh: item?.estimateHigh,
      phase: item?.phase,
    });
    let stories = Array.isArray(parsed?.stories) ? parsed.stories : [];
    // Some models return tasks directly with no stories.
    if (!stories.length && Array.isArray(parsed?.tasks)) {
      stories = [{ title: 'General', tasks: parsed.tasks }];
    }
    return stories.map((story: any) => {
      let tasks = Array.isArray(story?.tasks) ? story.tasks : [];
      if (!tasks.length && hasEstimate(story)) tasks = [asTask(story)];
      return { ...story, tasks };
    });
  }

  private buildTree(allItems: DeliveryItem[]): DeliveryTree {
    const childrenByParent = new Map<number | null, DeliveryItem[]>();
    for (const item of allItems) {
      const key = item.parentId ?? null;
      const siblings = childrenByParent.get(key) ?? [];
      siblings.push(item);
      childrenByParent.set(key, siblings);
    }
    const sort = (a: DeliveryItem, b: DeliveryItem) => a.orderIndex - b.orderIndex || a.id - b.id;

    const buildNode = (item: DeliveryItem): DeliveryNode => {
      const children = (childrenByParent.get(item.id) ?? []).sort(sort).map(buildNode);
      let totalLow: number;
      let totalHigh: number;
      if (item.level === DeliveryLevel.TASK) {
        totalLow = item.estimateLow ?? 0;
        totalHigh = item.estimateHigh ?? item.estimateLow ?? 0;
      } else {
        totalLow = children.reduce((sum, child) => sum + child.totalLow, 0);
        totalHigh = children.reduce((sum, child) => sum + child.totalHigh, 0);
      }
      return {
        id: item.id,
        level: item.level,
        title: item.title,
        description: item.description ?? null,
        phase: item.phase ?? null,
        estimateLow: item.estimateLow ?? null,
        estimateHigh: item.estimateHigh ?? null,
        totalLow,
        totalHigh,
        children,
      };
    };

    const epics = (childrenByParent.get(null) ?? [])
      .filter((item) => item.level === DeliveryLevel.EPIC)
      .sort(sort)
      .map(buildNode);
    return {
      epics,
      totalLow: epics.reduce((sum, epic) => sum + epic.totalLow, 0),
      totalHigh: epics.reduce((sum, epic) => sum + epic.totalHigh, 0),
    };
  }

  private estimateRange(lo: any, hi: any): [number | null, number | null] {
    const lowValue = this.toInt(lo);
    const highValue = this.toInt(hi);
    if (lowValue === null && highValue === null) return [null, null];
    const low = lowValue ?? highValue!;
    const high = highValue ?? lowValue!;
    return [Math.min(low, high), Math.max(low, high)];
  }

  private toInt(value: any): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.round(num)) : null;
  }

  private toPhase(value: any): string | null {
    const text = this.toText(value).trim();
    return text ? text.slice(0, 40) : null;
  }

  private toBulletList(value: any): string {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    return items.map((item) => `- ${this.toText(item)}`).join('\n') || '(none)';
  }

  private toStoryBulletList(value: any): string {
    const stories = Array.isArray(value) ? value : [];
    if (!stories.length) return '(none)';
    return stories
      .map(
        (userStory: any) =>
          `- ${userStory?.role ? `[${this.toText(userStory.role)}] ` : ''}${this.toText(userStory?.story)}`,
      )
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
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
    return parsed;
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
