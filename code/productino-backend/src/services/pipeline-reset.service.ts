import { Injectable } from '@nestjs/common';
import { DeliveryLevel, ProjectStage, QuestionStatus } from '@prisma/client';
import { User } from '../entities';
import {
  BeliefNodeRepository,
  ConflictRepository,
  CoverageAreaRepository,
  DeliveryItemRepository,
  ProductDefinitionRepository,
  ProjectRepository,
  ProjectRoundRepository,
  ProposalRepository,
  QuestionRepository,
} from '../repository';
import { ProjectService } from './project.service';

/** Which step a manual reset starts from; everything downstream is cleared too. */
export type ResetFrom = 'graph' | 'definition' | 'delivery' | 'proposal';

/**
 * Keeps the pipeline consistent. Each step's outputs are derived from the step
 * before it, so re-running an upstream step makes everything downstream stale.
 * Services call the `after*` methods to auto-cascade that staleness away; the
 * `resetFrom` method backs the manual, user-triggered reset.
 *
 * `ProjectRound` snapshots (the convergence ledger) are append-only and are NOT
 * cleared by auto-cascade — only by an explicit full graph reset.
 */
@Injectable()
export class PipelineResetService {
  constructor(
    private readonly projects: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly nodes: BeliefNodeRepository,
    private readonly coverage: CoverageAreaRepository,
    private readonly questions: QuestionRepository,
    private readonly rounds: ProjectRoundRepository,
    private readonly conflicts: ConflictRepository,
    private readonly definitions: ProductDefinitionRepository,
    private readonly deliveryItems: DeliveryItemRepository,
    private readonly proposals: ProposalRepository,
  ) {}

  // ── auto-cascade (called by the step services after they re-run) ──

  /** Beliefs changed → coverage, open questions, conflicts and the whole
   *  delivery chain are stale. Rounds and answered questions are preserved. */
  async afterExtraction(projectId: number): Promise<void> {
    await Promise.all([
      this.coverage.deleteMany({ projectId }),
      this.questions.deleteMany({ projectId, status: { not: QuestionStatus.ANSWERED } }),
      this.conflicts.deleteMany({ projectId }),
      this.definitions.deleteMany({ projectId }),
      this.proposals.deleteMany({ projectId }),
    ]);
    await this.clearDelivery(projectId);
  }

  /** Coverage changed → the PRD and everything built from it are stale. */
  async afterScoring(projectId: number): Promise<void> {
    await this.clearDefinitionDown(projectId);
  }

  /** PRD changed → the delivery plan and proposal are stale. */
  async afterDefinition(projectId: number): Promise<void> {
    await this.proposals.deleteMany({ projectId });
    await this.clearDelivery(projectId);
  }

  /** Delivery plan changed → the proposal is stale. */
  async afterDelivery(projectId: number): Promise<void> {
    await this.proposals.deleteMany({ projectId });
  }

  // ── manual reset (user-triggered; enforces tenancy) ───────────────

  async resetFrom(projectId: number, user: User, from: ResetFrom): Promise<void> {
    await this.projects.findOne(projectId, user); // enforces tenancy
    switch (from) {
      case 'graph':
        return this.resetGraph(projectId);
      case 'definition':
        await this.clearDefinitionDown(projectId);
        return this.rollbackStage(projectId, ProjectStage.GAP_ANALYSIS);
      case 'delivery':
        await this.proposals.deleteMany({ projectId });
        await this.clearDelivery(projectId);
        return this.rollbackStage(projectId, ProjectStage.DEFINITION);
      case 'proposal':
        await this.proposals.deleteMany({ projectId });
        return;
    }
  }

  // ── helpers ───────────────────────────────────────────────────────

  /** Wipe the whole Understanding layer + everything downstream (keeps sources). */
  private async resetGraph(projectId: number): Promise<void> {
    await Promise.all([
      this.nodes.deleteMany({ projectId }),
      this.coverage.deleteMany({ projectId }),
      this.questions.deleteMany({ projectId }),
      this.rounds.deleteMany({ projectId }),
      this.conflicts.deleteMany({ projectId }),
      this.definitions.deleteMany({ projectId }),
      this.proposals.deleteMany({ projectId }),
    ]);
    await this.clearDelivery(projectId);
    await this.rollbackStage(projectId, ProjectStage.BRIEFING);
  }

  private async clearDefinitionDown(projectId: number): Promise<void> {
    await Promise.all([
      this.definitions.deleteMany({ projectId }),
      this.proposals.deleteMany({ projectId }),
    ]);
    await this.clearDelivery(projectId);
  }

  /** Delete delivery items children-first to respect the self-relation FK. */
  private async clearDelivery(projectId: number): Promise<void> {
    for (const level of [DeliveryLevel.TASK, DeliveryLevel.STORY, DeliveryLevel.EPIC]) {
      await this.deliveryItems.deleteMany({ projectId, level });
    }
  }

  private async rollbackStage(projectId: number, stage: ProjectStage): Promise<void> {
    await this.projectRepo.update(projectId, { stage } as any);
  }
}
