import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Conflict } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class ConflictRepository extends PrismaRepository<
  Conflict,
  Prisma.ConflictCreateInput,
  Prisma.ConflictUpdateInput
> {
  protected readonly model = 'conflict' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Conflict);
  }

  findAllForProject(projectId: number): Promise<Conflict[]> {
    return this.findMany({ where: { projectId }, orderBy: { id: 'asc' } });
  }
}
