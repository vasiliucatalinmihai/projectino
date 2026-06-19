import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DeliveryLevel, ProjectStage } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { DeliveryItem, User } from '../entities';
import {
  DeliveryItemRepository,
  ProductDefinitionRepository,
  ProjectRepository,
} from '../repository';
import {
  EstimateEpicResult,
  EstimateEpicSchema,
  GenerateEpicPlanResult,
  GenerateEpicPlanSchema,
  GenerateEpicsResult,
  GenerateEpicsSchema,
  StructuredLlmService,
} from '../llm';
import { createConcurrencyLimiter } from '../common/concurrency';
import { ProjectService } from './project.service';
import { PipelineResetService } from './pipeline-reset.service';

/** A single task estimated above this many person-days is almost certainly a
 *  model error (and would distort the proposal price); clamp it to the ceiling. */
const MAX_TASK_DAYS = 60;

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
 * Generation is split into shallow LLM calls so weaker models nest reliably and
 * so estimation is its own focused step: one call lists the epics, then per epic
 * one call produces its stories+tasks (no numbers) and a second call sizes all of
 * that epic's tasks together — seeing the whole task set lets the model size them
 * relative to one another instead of pricing each task as it's invented. All
 * outputs are validated/normalized by their schemas (the weak-nesting rescue
 * lives in GenerateEpicPlanSchema). Per-epic work runs in parallel.
 */
@Injectable()
export class DeliveryService {
  constructor(
    private readonly projects: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly items: DeliveryItemRepository,
    private readonly definitions: ProductDefinitionRepository,
    private readonly structured: StructuredLlmService,
    private readonly reset: PipelineResetService,
  ) {}

  /** Nested epics→stories→tasks with rolled-up estimate ranges. */
  async tree(projectId: number, user: User): Promise<DeliveryTree> {
    await this.projects.findOne(projectId, user);
    const allItems = await this.items.findAllForProject(projectId);
    return this.buildTree(allItems);
  }

  /** The delivery plan rendered as a shareable markdown document. */
  async buildDoc(projectId: number, user: User): Promise<string> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const tree = this.buildTree(await this.items.findAllForProject(projectId));

    const days = (lo: number | null, hi: number | null): string => {
      if (lo == null && hi == null) return '—';
      return lo === hi ? `${lo}d` : `${lo ?? 0}–${hi ?? 0}d`;
    };

    const lines: string[] = [`# Delivery plan — ${project.name}`, ''];
    if (!tree.epics.length) {
      lines.push('_No delivery plan generated yet._');
      return lines.join('\n');
    }
    lines.push(`**Total estimate: ${days(tree.totalLow, tree.totalHigh)}**`, '');

    for (const epic of tree.epics) {
      lines.push(`## ${epic.title} — ${days(epic.totalLow, epic.totalHigh)}`);
      if (epic.description) lines.push('', epic.description);
      for (const story of epic.children) {
        lines.push('', `### ${story.title} — ${days(story.totalLow, story.totalHigh)}`);
        for (const task of story.children) {
          const phase = task.phase ? ` _(${task.phase})_` : '';
          lines.push(`- ${task.title} — ${days(task.estimateLow, task.estimateHigh)}${phase}`);
        }
      }
      lines.push('');
    }
    return lines.join('\n').trim();
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
    const { epics } = await this.structured.run({
      promptKey: PromptKey.GENERATE_EPICS,
      vars: { summary: prd.summary, inScope: prd.inScope, userStories: prd.userStories },
      schema: GenerateEpicsSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: (value: GenerateEpicsResult) => value.epics.length,
    });
    if (!epics.length) {
      throw new UnprocessableEntityException('Model did not return any epics');
    }

    // Regenerate: clear the old plan (children first to respect the self-FK).
    for (const level of [DeliveryLevel.TASK, DeliveryLevel.STORY, DeliveryLevel.EPIC]) {
      await this.items.deleteMany({ projectId, level });
    }

    // Create the epic rows first (so children can reference them).
    const epicRows: Array<{ row: DeliveryItem; epic: GenerateEpicsResult['epics'][number] }> = [];
    for (let epicIndex = 0; epicIndex < epics.length; epicIndex++) {
      const row = await this.items.create({
        project: { connect: { id: projectId } },
        level: DeliveryLevel.EPIC,
        title: epics[epicIndex].title.slice(0, 200) || `Epic ${epicIndex + 1}`,
        description: epics[epicIndex].description || null,
        orderIndex: epicIndex,
      } as any);
      epicRows.push({ row, epic: epics[epicIndex] });
    }

    // 2) Stories + tasks per epic, capped at 3 concurrent so a burst of calls
    //    doesn't trip provider rate limits. A failed epic plan is skipped, not
    //    fatal, so one flaky call doesn't lose the whole plan.
    const limit = createConcurrencyLimiter(3);
    await Promise.all(
      epicRows.map(({ row, epic }) =>
        limit(() => this.planEpic(project.id, user.accountId, prd, row, epic).catch(() => undefined)),
      ),
    );

    // Move into PLANNING. Regenerating the plan clears any proposal below
    // (afterDelivery), so dropping back from PROPOSAL → PLANNING is correct.
    await this.projectRepo.update(project.id, { stage: ProjectStage.PLANNING } as any);

    // A regenerated plan makes any existing proposal stale.
    await this.reset.afterDelivery(project.id);

    return this.buildTree(await this.items.findAllForProject(projectId));
  }

  // ── generation ───────────────────────────────────────────────────

  /**
   * Generate one epic's stories+tasks (decomposition), then estimate all of its
   * tasks in a second call, then persist the tree under the epic row.
   */
  private async planEpic(
    projectId: number,
    accountId: number,
    prd: PrdContext,
    epicRow: DeliveryItem,
    epic: GenerateEpicsResult['epics'][number],
  ): Promise<void> {
    // 1) Decompose into stories + tasks (no numbers).
    const { stories } = await this.structured.run({
      promptKey: PromptKey.GENERATE_EPIC_PLAN,
      vars: {
        summary: prd.summary,
        nonFunctional: prd.nonFunctional,
        epicTitle: epic.title,
        epicDescription: epic.description,
      },
      schema: GenerateEpicPlanSchema,
      accountId,
      subject: { type: 'project', id: projectId },
      scoreOf: (value: GenerateEpicPlanResult) =>
        value.stories.reduce((sum, story) => sum + story.tasks.length, 0),
    });

    // Flatten the tasks into one indexed list (1-based) so a single estimate
    // call can size the whole epic at once and we can map the numbers back.
    const flat: Array<{ index: number; storyTitle: string; task: GenerateEpicPlanResult['stories'][number]['tasks'][number] }> = [];
    for (const story of stories) {
      for (const task of story.tasks) {
        flat.push({ index: flat.length + 1, storyTitle: story.title, task });
      }
    }
    if (!flat.length) return;

    // 2) Estimate all tasks together. Estimates are a best-effort enrichment —
    //    if the call fails we still keep the decomposition (tasks land unestimated)
    //    rather than losing the whole epic.
    const estimateByIndex = await this.estimateTasks(projectId, accountId, prd, epic, flat);

    // 3) Persist, walking the tasks in the SAME order used to build `flat` so the
    //    1-based index lines up with the returned estimates.
    let storyIndex = 0;
    let globalIndex = 0;
    for (const story of stories) {
      const storyRow = await this.items.create({
        project: { connect: { id: projectId } },
        parent: { connect: { id: epicRow.id } },
        level: DeliveryLevel.STORY,
        title: story.title.slice(0, 200) || `Story ${storyIndex + 1}`,
        description: story.description || null,
        orderIndex: storyIndex++,
      } as any);

      let taskIndex = 0;
      for (const task of story.tasks) {
        const estimate = estimateByIndex.get(++globalIndex);
        const [low, high] = this.estimateRange(estimate?.estimateLow ?? null, estimate?.estimateHigh ?? null);
        await this.items.create({
          project: { connect: { id: projectId } },
          parent: { connect: { id: storyRow.id } },
          level: DeliveryLevel.TASK,
          title: task.title.slice(0, 200) || `Task ${taskIndex + 1}`,
          description: task.description || null,
          estimateLow: low,
          estimateHigh: high,
          phase: this.toPhase(task.phase),
          orderIndex: taskIndex++,
        } as any);
      }
    }
  }

  /**
   * Size every task of one epic in a single LLM call. Returns a map from the
   * 1-based task index to its estimate; empty if the call fails (the caller then
   * persists the tasks unestimated rather than dropping the epic).
   */
  private async estimateTasks(
    projectId: number,
    accountId: number,
    prd: PrdContext,
    epic: GenerateEpicsResult['epics'][number],
    flat: Array<{ index: number; storyTitle: string; task: GenerateEpicPlanResult['stories'][number]['tasks'][number] }>,
  ): Promise<Map<number, EstimateEpicResult['estimates'][number]>> {
    const taskList = flat
      .map(({ index, storyTitle, task }) => {
        const phase = task.phase ? ` (${task.phase})` : '';
        const story = storyTitle ? `[${storyTitle}] ` : '';
        return `${index}. ${story}${task.title}${phase}`;
      })
      .join('\n');

    try {
      const { estimates } = await this.structured.run({
        promptKey: PromptKey.ESTIMATE_EPIC,
        vars: {
          summary: prd.summary,
          nonFunctional: prd.nonFunctional,
          epicTitle: epic.title,
          epicDescription: epic.description,
          tasks: taskList,
        },
        schema: EstimateEpicSchema,
        accountId,
        subject: { type: 'project', id: projectId },
        scoreOf: (value: EstimateEpicResult) => value.estimates.length,
      });
      return new Map(estimates.map((estimate) => [estimate.index, estimate]));
    } catch {
      return new Map();
    }
  }

  // ── helpers ─────────────────────────────────────────────────────

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

  private estimateRange(lo: number | null, hi: number | null): [number | null, number | null] {
    if (lo === null && hi === null) return [null, null];
    const low = Math.min(MAX_TASK_DAYS, lo ?? hi!);
    const high = Math.min(MAX_TASK_DAYS, hi ?? lo!);
    return [Math.min(low, high), Math.max(low, high)];
  }

  private toPhase(value: string): string | null {
    const text = (value ?? '').trim();
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

  private toText(value: any): string {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }
}
