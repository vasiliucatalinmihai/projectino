import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ProjectRound } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class ProjectRoundRepository extends PrismaRepository<
  ProjectRound,
  Prisma.ProjectRoundCreateInput,
  Prisma.ProjectRoundUpdateInput
> {
  protected readonly model = 'projectRound' as const;

  constructor(prisma: PrismaService) {
    super(prisma, ProjectRound);
  }

  /** All rounds for a project, oldest first (for plotting convergence). */
  findAllForProject(projectId: number): Promise<ProjectRound[]> {
    return this.findMany({ where: { projectId }, orderBy: { index: 'asc' } });
  }
}
