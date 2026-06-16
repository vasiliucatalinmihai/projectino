import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Proposal } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class ProposalRepository extends PrismaRepository<
  Proposal,
  Prisma.ProposalCreateInput,
  Prisma.ProposalUpdateInput
> {
  protected readonly model = 'proposal' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Proposal);
  }

  findLatestForProject(projectId: number): Promise<Proposal | null> {
    return this.findFirst({ where: { projectId }, orderBy: { version: 'desc' } });
  }

  countForProject(projectId: number): Promise<number> {
    return this.count({ where: { projectId } });
  }
}
