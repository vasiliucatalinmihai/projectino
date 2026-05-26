import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Prompt } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class PromptRepository extends PrismaRepository<
  Prompt,
  Prisma.PromptCreateInput,
  Prisma.PromptUpdateInput
> {
  protected readonly model = 'prompt' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Prompt);
  }

  findByKey(key: string): Promise<Prompt | null> {
    return this.findUnique({ where: { key } });
  }
}
