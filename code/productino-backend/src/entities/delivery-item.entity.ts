import { DeliveryLevel } from '@prisma/client';
import { BaseEntity } from './base.entity';

/**
 * DELIVERY layer node: an Epic, Story or Task. One polymorphic table with a
 * self-relation (parentId) and a level. Ranged estimates (days) sit on tasks;
 * story/epic totals are rolled up when building the tree.
 */
export class DeliveryItem extends BaseEntity {
  id: number;
  projectId: number;
  parentId: number | null;
  level: DeliveryLevel;
  title: string;
  description: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  phase: string | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<DeliveryItem>) {
    super(partial);
  }
}
