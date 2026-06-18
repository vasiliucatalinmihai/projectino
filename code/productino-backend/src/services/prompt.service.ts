import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PromptRepository,
  PromptRunRepository,
  PromptVersionRepository,
  VersionStats,
} from '../repository';
import { PromptRun } from '../entities';

// Service-level outputs (no HTTP DTOs).
export interface PromptSummary {
  id: number;
  key: string;
  description: string | null;
  activeVersion: number | null;
  versionCount: number;
  runCount: number;
}
export interface PromptVersionSummary {
  id: number;
  version: number;
  isActive: boolean;
  source: string;
  content: string;
  config: Record<string, any>;
  notes: string | null;
  createdAt: Date;
  stats: VersionStats;
}
export interface PromptDetail {
  id: number;
  key: string;
  description: string | null;
  activeVersion: number | null;
  versions: PromptVersionSummary[];
  recentRuns: PromptRun[];
}

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

  async list(): Promise<PromptSummary[]> {
    const allPrompts = await this.prompts.findAll();
    const summaries = await Promise.all(
      allPrompts.map(async (prompt) => {
        const versions = await this.versions.findMany({ where: { promptId: prompt.id } });
        const active = versions.find((version) => version.id === prompt.activeVersionId);
        const runCount = await this.runs.count({ where: { promptKey: prompt.key } });
        return {
          id: prompt.id,
          key: prompt.key,
          description: prompt.description,
          activeVersion: active?.version ?? null,
          versionCount: versions.length,
          runCount,
        };
      }),
    );
    return summaries.sort((a, b) => a.key.localeCompare(b.key));
  }

  async detail(key: string): Promise<PromptDetail> {
    const prompt = await this.prompts.findByKey(key);
    if (!prompt) throw new NotFoundException(`Prompt "${key}" not found`);

    const versions = await this.versions.findMany({
      where: { promptId: prompt.id },
      orderBy: { version: 'desc' },
    });
    const statsByVersion = await this.runs.statsByVersion(key);
    const active = versions.find((version) => version.id === prompt.activeVersionId);

    const versionSummaries: PromptVersionSummary[] = versions.map((version) => ({
      id: version.id,
      version: version.version,
      isActive: version.id === prompt.activeVersionId,
      source: version.source,
      content: version.content,
      config: (version.config as Record<string, any>) ?? {},
      notes: version.notes,
      createdAt: version.createdAt,
      stats: statsByVersion.get(version.id) ?? EMPTY_STATS,
    }));

    const recentRuns = await this.runs.findMany({
      where: { promptKey: key },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      id: prompt.id,
      key: prompt.key,
      description: prompt.description,
      activeVersion: active?.version ?? null,
      versions: versionSummaries,
      recentRuns,
    };
  }
}
