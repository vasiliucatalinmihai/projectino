import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TechDesign } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class TechDesignRepository extends PrismaRepository<
  TechDesign,
  Prisma.TechDesignCreateInput,
  Prisma.TechDesignUpdateInput
> {
  protected readonly model = 'techDesign' as const;

  constructor(prisma: PrismaService) {
    super(prisma, TechDesign);
  }

  findLatestForProject(projectId: number): Promise<TechDesign | null> {
    return this.findFirst({ where: { projectId }, orderBy: { version: 'desc' } });
  }

  countForProject(projectId: number): Promise<number> {
    return this.count({ where: { projectId } });
  }
}
