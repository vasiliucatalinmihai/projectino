import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PromptVersion } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class PromptVersionRepository extends PrismaRepository<
  PromptVersion,
  Prisma.PromptVersionCreateInput,
  Prisma.PromptVersionUpdateInput
> {
  protected readonly model = 'promptVersion' as const;

  constructor(prisma: PrismaService) {
    super(prisma, PromptVersion);
  }

  findByChecksum(promptId: number, checksum: string): Promise<PromptVersion | null> {
    return this.findFirst({ where: { promptId, checksum } });
  }

  async maxVersion(promptId: number): Promise<number> {
    const latest = await this.findFirst({ where: { promptId }, orderBy: { version: 'desc' } });
    return latest?.version ?? 0;
  }
}
