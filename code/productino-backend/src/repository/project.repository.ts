import { Injectable } from '@nestjs/common';
import { Prisma, ProjectStage } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Project } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class ProjectRepository extends PrismaRepository<
  Project,
  Prisma.ProjectCreateInput,
  Prisma.ProjectUpdateInput
> {
  protected readonly model = 'project' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Project);
  }

  // Add query methods specific to projects here, e.g.:
  findByStage(stage: ProjectStage): Promise<Project[]> {
    return this.findMany({ where: { stage }, orderBy: { updatedAt: 'desc' } });
  }
}
