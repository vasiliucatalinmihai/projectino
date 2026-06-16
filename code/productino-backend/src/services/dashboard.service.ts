import { Injectable } from '@nestjs/common';
import { ProjectStage } from '@prisma/client';
import { AccountRepository, ClientRepository, ProjectRepository } from '../repository';

export interface DashboardStage {
  stage: string;
  count: number;
  pct: number; // share of all tenant projects, 0–100 (1 decimal)
}
export interface DashboardOverview {
  accountCount: number; // tenant accounts (excludes the system account)
  clientCount: number;
  projectCount: number;
  stages: DashboardStage[];
}

/**
 * Platform overview for super admins: aggregate counts across **tenant**
 * accounts (everything except the system account) plus the project-stage
 * distribution. Read-only; goes through the repositories.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly clients: ClientRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async overview(): Promise<DashboardOverview> {
    const system = await this.accounts.findSystemAccount();
    // Exclude the platform's own (system) account from every tally.
    const where = system ? { accountId: { not: system.id } } : {};

    const [accountCount, clientCount, projectCount, grouped] = await Promise.all([
      this.accounts.count({ where: { isSystem: false } }),
      this.clients.count({ where }),
      this.projects.count({ where }),
      this.projects.groupBy({ by: ['stage'], where, _count: { _all: true } }),
    ]);

    const counts = new Map<string, number>(
      grouped.map((g: any) => [g.stage as string, g._count?._all ?? 0]),
    );

    // Cover every stage (0% when absent) so the UI is stable.
    const stages: DashboardStage[] = Object.values(ProjectStage).map((stage) => {
      const count = counts.get(stage) ?? 0;
      const pct = projectCount ? Math.round((count / projectCount) * 1000) / 10 : 0;
      return { stage, count, pct };
    });

    return { accountCount, clientCount, projectCount, stages };
  }
}
