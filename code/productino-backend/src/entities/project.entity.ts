import { ProjectStage } from '@prisma/client';
import { BaseEntity } from './base.entity';

export class Project extends BaseEntity {
  id: number;
  name: string;
  clientName: string | null;
  briefing: string | null;
  stage: ProjectStage;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Project>) {
    super(partial);
  }

  // Example of active-record behaviour: domain logic lives on the entity,
  // then `projectRepository.save(project)` persists the mutated instance.
  advanceTo(stage: ProjectStage): void {
    this.stage = stage;
  }

  get hasBriefing(): boolean {
    return !!this.briefing && this.briefing.trim().length > 0;
  }
}
