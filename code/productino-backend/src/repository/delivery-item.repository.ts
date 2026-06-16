import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { DeliveryItem } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class DeliveryItemRepository extends PrismaRepository<
  DeliveryItem,
  Prisma.DeliveryItemCreateInput,
  Prisma.DeliveryItemUpdateInput
> {
  protected readonly model = 'deliveryItem' as const;

  constructor(prisma: PrismaService) {
    super(prisma, DeliveryItem);
  }

  findAllForProject(projectId: number): Promise<DeliveryItem[]> {
    return this.findMany({ where: { projectId }, orderBy: { id: 'asc' } });
  }
}
