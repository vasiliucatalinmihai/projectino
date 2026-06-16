import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ProductDefinition } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class ProductDefinitionRepository extends PrismaRepository<
  ProductDefinition,
  Prisma.ProductDefinitionCreateInput,
  Prisma.ProductDefinitionUpdateInput
> {
  protected readonly model = 'productDefinition' as const;

  constructor(prisma: PrismaService) {
    super(prisma, ProductDefinition);
  }

  /** Latest version for a project (null if never generated). */
  findLatestForProject(projectId: number): Promise<ProductDefinition | null> {
    return this.findFirst({ where: { projectId }, orderBy: { version: 'desc' } });
  }

  countForProject(projectId: number): Promise<number> {
    return this.count({ where: { projectId } });
  }
}
