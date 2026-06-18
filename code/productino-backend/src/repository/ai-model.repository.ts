import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AiModel } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class AiModelRepository extends PrismaRepository<
  AiModel,
  Prisma.AiModelCreateInput,
  Prisma.AiModelUpdateInput
> {
  protected readonly model = 'aiModel' as const;

  constructor(prisma: PrismaService) {
    super(prisma, AiModel);
  }

  findForAccount(accountId: number): Promise<AiModel[]> {
    return this.findMany({
      where: { accountId },
      orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
    });
  }

  findActiveForAccount(accountId: number): Promise<AiModel | null> {
    return this.findFirst({ where: { accountId, isActive: true } });
  }

  /** Atomically add one call's spend to a model's lifetime counters. */
  async recordUsage(id: number, tokensIn: number, tokensOut: number): Promise<void> {
    await this.update(id, {
      runCount: { increment: 1 },
      tokensIn: { increment: tokensIn },
      tokensOut: { increment: tokensOut },
      lastUsedAt: new Date(),
    } as any);
  }
}
