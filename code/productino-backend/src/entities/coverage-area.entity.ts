import { CoverageStatus } from '@prisma/client';
import { BaseEntity } from './base.entity';

/**
 * The convergence engine. One rubric category whose `rollupConfidence` is
 * derived from its belief nodes; the weighted project rollup is the
 * "defined enough?" gate.
 */
export class CoverageArea extends BaseEntity {
  id: number;
  projectId: number;
  key: string;
  name: string;
  weight: string; // high | medium | low
  rollupConfidence: number;
  status: CoverageStatus;
  round: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<CoverageArea>) {
    super(partial);
  }
}
