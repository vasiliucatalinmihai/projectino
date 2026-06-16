import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PromptRun } from '../entities';
import { PrismaRepository } from './prisma.repository';

export interface VersionStats {
  runs: number;
  successRate: number | null; // 0–100
  avgScore: number | null;
  avgLatencyMs: number | null;
  avgTokensIn: number | null;
  avgTokensOut: number | null;
}

export interface TokenUsage {
  runs: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
}

export interface PromptTokenUsage extends TokenUsage {
  promptKey: string;
}

@Injectable()
export class PromptRunRepository extends PrismaRepository<
  PromptRun,
  Prisma.PromptRunCreateInput,
  Prisma.PromptRunUpdateInput
> {
  protected readonly model = 'promptRun' as const;

  constructor(prisma: PrismaService) {
    super(prisma, PromptRun);
  }

  /** Aggregate run stats per version for a prompt key. */
  async statsByVersion(promptKey: string): Promise<Map<number, VersionStats>> {
    const agg = await this.groupBy({
      by: ['versionId'],
      where: { promptKey },
      _count: { _all: true },
      _avg: { score: true, latencyMs: true, tokensIn: true, tokensOut: true },
    });
    const succ = await this.groupBy({
      by: ['versionId'],
      where: { promptKey, success: true },
      _count: { _all: true },
    });
    const successByVersion = new Map<number, number>(
      succ.map((s: any) => [s.versionId, s._count._all]),
    );

    const round = (n: number | null) => (n == null ? null : Math.round(n));
    const map = new Map<number, VersionStats>();
    for (const r of agg as any[]) {
      const runs = r._count._all;
      const successes = successByVersion.get(r.versionId) ?? 0;
      map.set(r.versionId, {
        runs,
        successRate: runs ? Math.round((successes / runs) * 100) : null,
        avgScore: r._avg.score,
        avgLatencyMs: round(r._avg.latencyMs),
        avgTokensIn: round(r._avg.tokensIn),
        avgTokensOut: round(r._avg.tokensOut),
      });
    }
    return map;
  }

  /** Total tokens across every run attributed to a subject (e.g. a project). */
  async tokenUsageForSubject(subjectType: string, subjectId: number): Promise<TokenUsage> {
    const totals = await this.aggregate({
      where: { subjectType, subjectId },
      _sum: { tokensIn: true, tokensOut: true },
      _count: { _all: true },
    });
    const tokensIn = totals._sum.tokensIn ?? 0;
    const tokensOut = totals._sum.tokensOut ?? 0;
    return { runs: totals._count._all, tokensIn, tokensOut, totalTokens: tokensIn + tokensOut };
  }

  /** Token usage for a subject, broken down per prompt (which stage spent what). */
  async tokenUsageByPromptForSubject(
    subjectType: string,
    subjectId: number,
  ): Promise<PromptTokenUsage[]> {
    const rows = await this.groupBy({
      by: ['promptKey'],
      where: { subjectType, subjectId },
      _sum: { tokensIn: true, tokensOut: true },
      _count: { _all: true },
    });
    return (rows as any[]).map((row) => {
      const tokensIn = row._sum.tokensIn ?? 0;
      const tokensOut = row._sum.tokensOut ?? 0;
      return {
        promptKey: row.promptKey,
        runs: row._count._all,
        tokensIn,
        tokensOut,
        totalTokens: tokensIn + tokensOut,
      };
    });
  }
}
