import { Injectable } from '@nestjs/common';
import { Prisma, SourceKind } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Source } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class SourceRepository extends PrismaRepository<
  Source,
  Prisma.SourceCreateInput,
  Prisma.SourceUpdateInput
> {
  protected readonly model = 'source' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Source);
  }

  findAllForProject(projectId: number): Promise<Source[]> {
    return this.findMany({ where: { projectId }, orderBy: { id: 'asc' } });
  }

  /** The project's briefing source (the seed input), if any. */
  findBriefing(projectId: number): Promise<Source | null> {
    return this.findFirst({
      where: { projectId, kind: SourceKind.BRIEFING },
      orderBy: { id: 'asc' },
    });
  }
}
