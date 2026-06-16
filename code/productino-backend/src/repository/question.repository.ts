import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Question } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class QuestionRepository extends PrismaRepository<
  Question,
  Prisma.QuestionCreateInput,
  Prisma.QuestionUpdateInput
> {
  protected readonly model = 'question' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Question);
  }

  findAllForProject(projectId: number): Promise<Question[]> {
    return this.findMany({ where: { projectId }, orderBy: { id: 'asc' } });
  }
}
