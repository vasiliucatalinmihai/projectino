import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CoverageArea } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class CoverageAreaRepository extends PrismaRepository<
  CoverageArea,
  Prisma.CoverageAreaCreateInput,
  Prisma.CoverageAreaUpdateInput
> {
  protected readonly model = 'coverageArea' as const;

  constructor(prisma: PrismaService) {
    super(prisma, CoverageArea);
  }

  findAllForProject(projectId: number): Promise<CoverageArea[]> {
    return this.findMany({ where: { projectId }, orderBy: { id: 'asc' } });
  }
}
