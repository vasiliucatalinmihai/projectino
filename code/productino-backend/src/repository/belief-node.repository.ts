import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BeliefNode } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class BeliefNodeRepository extends PrismaRepository<
  BeliefNode,
  Prisma.BeliefNodeCreateInput,
  Prisma.BeliefNodeUpdateInput
> {
  protected readonly model = 'beliefNode' as const;

  constructor(prisma: PrismaService) {
    super(prisma, BeliefNode);
  }

  findAllForProject(projectId: number): Promise<BeliefNode[]> {
    return this.findMany({ where: { projectId }, orderBy: { id: 'asc' } });
  }
}
