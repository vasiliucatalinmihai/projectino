import { BaseEntity } from './base.entity';

/**
 * Snapshot of the weighted project rollup at the end of a round, so the UI can
 * show the convergence delta between question rounds ("Compliance 20% → 75%").
 */
export class ProjectRound extends BaseEntity {
  id: number;
  projectId: number;
  index: number;
  rollupConfidence: number;
  createdAt: Date;

  constructor(partial: Partial<ProjectRound>) {
    super(partial);
  }
}
