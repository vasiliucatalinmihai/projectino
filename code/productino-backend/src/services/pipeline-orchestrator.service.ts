import { Injectable } from '@nestjs/common';
import { ProjectStage } from '@prisma/client';
import { ProjectRepository } from '../repository';
import { CascadeStep, PipelineResetService } from './pipeline-reset.service';

/**
 * Single place every pipeline step (old and new) goes through to move `Project.stage`
 * forward. Replaces each service hand-rolling its own "set stage, then remember to
 * clear downstream" sequence with one call: cascade first (using the artifacts still
 * in place), then flip the stage.
 */
@Injectable()
export class PipelineOrchestratorService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly resetService: PipelineResetService,
  ) {}

  async advance(projectId: number, stage: ProjectStage, step?: CascadeStep): Promise<void> {
    if (step) await this.resetService.cascade(projectId, step);
    await this.projectRepository.update(projectId, { stage } as any);
  }
}
