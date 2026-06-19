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

/** Witch step a manual reset starts from; everything down is cleared too. */
export type ResetFrom = 'graph' | 'definition' | 'delivery' | 'proposal';

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

  // -- auto-cascade (called by the step services after they re-run) --

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

  async afterScoring(projectId: number): Promise<void> {
    await this.clearDefinitionDown(projectId);
  }

  async afterDefinition(projectId: number): Promise<void> {
    await this.proposals.deleteMany({ projectId });
    await this.clearDelivery(projectId);
  }

  async afterDelivery(projectId: number): Promise<void> {
    await this.proposals.deleteMany({ projectId });
  }

  // -- manual reset
  async resetFrom(projectId: number, user: User, from: ResetFrom): Promise<void> {
    await this.projects.getProjectForUser(projectId, user); // enforces tenancy
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

  private async clearDelivery(projectId: number): Promise<void> {
    for (const level of [DeliveryLevel.TASK, DeliveryLevel.STORY, DeliveryLevel.EPIC]) {
      await this.deliveryItems.deleteMany({ projectId, level });
    }
  }

  private async rollbackStage(projectId: number, stage: ProjectStage): Promise<void> {
    await this.projectRepo.update(projectId, { stage } as any);
  }
}
