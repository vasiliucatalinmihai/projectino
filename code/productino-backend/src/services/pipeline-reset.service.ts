import { Injectable } from '@nestjs/common';
import { DeliveryLevel, ProjectStage, QuestionStatus } from '@prisma/client';
import { User } from '../entities';
import { requiresTechDesign } from '../common/project-type';
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
  TechDesignRepository,
} from '../repository';
import { ProjectService } from './project.service';

/** Which step just (re)ran — everything a later step owns gets cleared. */
export type CascadeStep = 'extraction' | 'scoring' | 'definition' | 'techDesign' | 'delivery';

/** Which step a manual reset starts from; everything downstream is cleared too. */
export type ResetFrom = 'graph' | 'definition' | 'techDesign' | 'delivery' | 'proposal';

type CascadeTarget = 'coverage' | 'questions' | 'conflicts' | 'definitions' | 'techDesigns' | 'delivery' | 'proposals';

/**
 * Declarative "what does this step's artifact make stale downstream" map. One source of
 * truth replaces the previously hand-rolled afterExtraction/afterScoring/afterDefinition/
 * afterDelivery methods — every pipeline step (old and new) now cascades through the same
 * table, via `PipelineOrchestratorService.advance()`.
 */
const CASCADE_TARGETS: Record<CascadeStep, CascadeTarget[]> = {
  extraction: ['coverage', 'questions', 'conflicts', 'definitions', 'techDesigns', 'delivery', 'proposals'],
  scoring: ['definitions', 'techDesigns', 'delivery', 'proposals'],
  definition: ['techDesigns', 'delivery', 'proposals'],
  techDesign: ['delivery', 'proposals'],
  delivery: ['proposals'],
};

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
    private readonly techDesigns: TechDesignRepository,
    private readonly deliveryItems: DeliveryItemRepository,
    private readonly proposals: ProposalRepository,
  ) {}

  /** Clear everything a given step's artifact makes stale (called by the orchestrator). */
  async cascade(projectId: number, step: CascadeStep): Promise<void> {
    const targets = new Set(CASCADE_TARGETS[step]);
    const ops: Promise<any>[] = [];
    if (targets.has('coverage')) ops.push(this.coverage.deleteMany({ projectId }));
    if (targets.has('questions')) {
      ops.push(this.questions.deleteMany({ projectId, status: { not: QuestionStatus.ANSWERED } }));
    }
    if (targets.has('conflicts')) ops.push(this.conflicts.deleteMany({ projectId }));
    if (targets.has('definitions')) ops.push(this.definitions.deleteMany({ projectId }));
    if (targets.has('techDesigns')) ops.push(this.techDesigns.deleteMany({ projectId }));
    if (targets.has('proposals')) ops.push(this.proposals.deleteMany({ projectId }));
    await Promise.all(ops);
    if (targets.has('delivery')) await this.clearDelivery(projectId);
  }

  // -- manual reset --
  async resetFrom(projectId: number, user: User, from: ResetFrom): Promise<void> {
    const project = await this.projects.getProjectForUser(projectId, user); // enforces tenancy
    switch (from) {
      case 'graph':
        return this.resetGraph(projectId);
      case 'definition':
        await this.cascade(projectId, 'scoring');
        return this.rollbackStage(projectId, ProjectStage.GAP_ANALYSIS);
      case 'techDesign':
        await this.cascade(projectId, 'definition');
        return this.rollbackStage(projectId, ProjectStage.DEFINITION);
      case 'delivery':
        await this.cascade(projectId, 'techDesign');
        return this.rollbackStage(
          projectId,
          requiresTechDesign(project.projectType) ? ProjectStage.TECH_DESIGN : ProjectStage.DEFINITION,
        );
      case 'proposal':
        await this.cascade(projectId, 'delivery');
        return this.rollbackStage(projectId, ProjectStage.PLANNING);
    }
  }

  private async resetGraph(projectId: number): Promise<void> {
    await Promise.all([
      this.nodes.deleteMany({ projectId }),
      this.coverage.deleteMany({ projectId }),
      this.questions.deleteMany({ projectId }),
      this.rounds.deleteMany({ projectId }),
      this.conflicts.deleteMany({ projectId }),
      this.definitions.deleteMany({ projectId }),
      this.techDesigns.deleteMany({ projectId }),
      this.proposals.deleteMany({ projectId }),
    ]);
    await this.clearDelivery(projectId);
    await this.rollbackStage(projectId, ProjectStage.BRIEFING);
  }

  private async clearDelivery(projectId: number): Promise<void> {
    for (const level of [DeliveryLevel.TASK, DeliveryLevel.STORY, DeliveryLevel.EPIC]) {
      await this.deliveryItems.deleteMany({ projectId, level });
    }
  }

  private async rollbackStage(projectId: number, stage: ProjectStage): Promise<void> {
    await this.projectRepo.update(projectId, { stage } as any);
  }
}
