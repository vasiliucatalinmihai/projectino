import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PromptRepository,
  PromptRunRepository,
  PromptVersionRepository,
  VersionStats,
} from '../repository';
import {
  PromptDetailResponse,
  PromptRunResponse,
  PromptSummaryResponse,
  PromptVersionResponse,
} from '../http/response/prompt';

const EMPTY_STATS: VersionStats = {
  runs: 0,
  successRate: null,
  avgScore: null,
  avgLatencyMs: null,
  avgTokensIn: null,
  avgTokensOut: null,
};

/** Read-only admin queries over prompts, versions and their run stats. */
@Injectable()
export class PromptService {
  constructor(
    private readonly prompts: PromptRepository,
    private readonly versions: PromptVersionRepository,
    private readonly runs: PromptRunRepository,
  ) {}

  async list(): Promise<PromptSummaryResponse[]> {
    const all = await this.prompts.findAll();
    const summaries = await Promise.all(
      all.map(async (p) => {
        const versions = await this.versions.findMany({ where: { promptId: p.id } });
        const active = versions.find((v) => v.id === p.activeVersionId);
        const runCount = await this.runs.count({ where: { promptKey: p.key } });
        return new PromptSummaryResponse({
          id: p.id,
          key: p.key,
          description: p.description,
          activeVersion: active?.version ?? null,
          versionCount: versions.length,
          runCount,
        });
      }),
    );
    return summaries.sort((a, b) => a.key.localeCompare(b.key));
  }

  async detail(key: string): Promise<PromptDetailResponse> {
    const prompt = await this.prompts.findByKey(key);
    if (!prompt) throw new NotFoundException(`Prompt "${key}" not found`);

    const versions = await this.versions.findMany({
      where: { promptId: prompt.id },
      orderBy: { version: 'desc' },
    });
    const statsByVersion = await this.runs.statsByVersion(key);
    const active = versions.find((v) => v.id === prompt.activeVersionId);

    const versionDtos = versions.map(
      (v) =>
        new PromptVersionResponse({
          id: v.id,
          version: v.version,
          isActive: v.id === prompt.activeVersionId,
          source: v.source,
          model: (v.config as any)?.model ?? null,
          config: v.config ?? {},
          notes: v.notes,
          createdAt: v.createdAt,
          stats: statsByVersion.get(v.id) ?? EMPTY_STATS,
        }),
    );

    const recent = await this.runs.findMany({
      where: { promptKey: key },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return new PromptDetailResponse({
      id: prompt.id,
      key: prompt.key,
      description: prompt.description,
      activeVersion: active?.version ?? null,
      versions: versionDtos,
      recentRuns: recent.map(PromptRunResponse.fromEntity),
    });
  }
}
