import { ConflictStatus } from '@prisma/client';
import { BaseEntity } from './base.entity';

/**
 * A detected contradiction between two beliefs. Self-contained (stores the two
 * belief names) so it survives re-extraction that changes node ids.
 */
export class Conflict extends BaseEntity {
  id: number;
  projectId: number;
  summary: string;
  detail: string;
  beliefA: string;
  beliefB: string;
  status: ConflictStatus;
  round: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Conflict>) {
    super(partial);
  }
}
