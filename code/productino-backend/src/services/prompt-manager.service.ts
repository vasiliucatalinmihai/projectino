import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Handlebars from 'handlebars';
import matter from 'gray-matter';
import { PromptConfig, PromptRunContext, PromptRunOutcome, RenderedPrompt } from '../common/prompt-key';
import { PromptRepository, PromptRunRepository, PromptVersionRepository } from '../repository';
import { PromptRun } from '../entities';

interface CacheEntry {
  key: string;
  versionId: number;
  version: number;
  config: PromptConfig;
  render: (vars: Record<string, any>) => string;
}

/**
 * Resolves prompts for a given key. Markdown files in `src/prompts/` are the
 * authoring source; on boot they are synced into the DB as immutable versions,
 * and the active version per key is cached in memory for fast `get()`.
 *
 *   promptManager.get(PromptKey.GAP_ANALYSIS, { briefing })
 *
 * Phase 1: single active version per prompt. A/B experiments + run logging
 * (PromptExperiment / PromptRun tables) come in later phases.
 */
@Injectable()
export class PromptManagerService implements OnModuleInit {
  private readonly logger = new Logger(PromptManagerService.name);
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prompts: PromptRepository,
    private readonly versions: PromptVersionRepository,
    private readonly runs: PromptRunRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.syncFromFiles();
      await this.refreshCache();
      this.logger.log(`Loaded ${this.cache.size} active prompt(s): ${[...this.cache.keys()].join(', ')}`);
    } catch (e: any) {
      this.logger.error(`Prompt sync failed: ${e?.message}`, e?.stack);
    }
  }

  /** Render the active version of a prompt with the given variables. */
  get(key: string, vars: Record<string, any> = {}): RenderedPrompt {
    const entry = this.cache.get(key);
    if (!entry) {
      throw new NotFoundException(`No active prompt for key "${key}"`);
    }
    return {
      key: entry.key,
      versionId: entry.versionId,
      version: entry.version,
      config: entry.config,
      content: entry.render(vars),
    };
  }

  /**
   * Log the outcome of an LLM call against the prompt version that produced it.
   * Call after the call completes (or fails) so versions can be compared:
   *
   *   const p = mgr.get(PromptKey.GAP_ANALYSIS, { briefing });
   *   const t0 = Date.now();
   *   try {
   *     const res = await claude.run(p.content, p.config);
   *     await mgr.recordOutcome(p, { success: true, latencyMs: Date.now() - t0, tokensIn, tokensOut, score },
   *       { subjectType: 'project', subjectId });
   *   } catch (e) {
   *     await mgr.recordOutcome(p, { success: false, latencyMs: Date.now() - t0, meta: { error: e.message } });
   *   }
   */
  recordOutcome(
    rendered: RenderedPrompt,
    outcome: PromptRunOutcome,
    ctx: PromptRunContext = {},
  ): Promise<PromptRun> {
    return this.runs.create({
      promptKey: rendered.key,
      versionId: rendered.versionId,
      success: outcome.success ?? null,
      latencyMs: outcome.latencyMs ?? null,
      tokensIn: outcome.tokensIn ?? null,
      tokensOut: outcome.tokensOut ?? null,
      score: outcome.score ?? null,
      subjectType: ctx.subjectType ?? null,
      subjectId: ctx.subjectId ?? null,
      meta: outcome.meta ?? undefined,
    } as any);
  }

  /** Read prompt .md files and persist any new (changed) versions. */
  async syncFromFiles(): Promise<void> {
    const dir = this.resolvePromptsDir();
    if (!dir) {
      this.logger.warn('No prompts directory found; skipping sync');
      return;
    }
    const autoActivate = process.env.NODE_ENV !== 'production';
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const parsed = matter(raw);
      const data = (parsed.data ?? {}) as Record<string, any>;
      const key: string = data.key || path.basename(file, '.md');
      const content = parsed.content.trim();
      const { key: _k, description, ...config } = data;
      const checksum = crypto
        .createHash('sha256')
        .update(content + JSON.stringify(config))
        .digest('hex');

      let prompt = await this.prompts.findByKey(key);
      if (!prompt) {
        prompt = await this.prompts.create({ key, description: description ?? null } as any);
      } else if (description !== undefined && prompt.description !== description) {
        prompt = await this.prompts.update(prompt.id, { description } as any);
      }

      let version = await this.versions.findByChecksum(prompt.id, checksum);
      let created = false;
      if (!version) {
        const next = (await this.versions.maxVersion(prompt.id)) + 1;
        version = await this.versions.create({
          prompt: { connect: { id: prompt.id } },
          version: next,
          content,
          config,
          checksum,
          source: 'file',
        } as any);
        created = true;
        this.logger.log(`Prompt "${key}" → v${next} (from ${file})`);
      }

      // Activation policy: always pin the latest in dev; in prod only auto-pin
      // when nothing is active yet (otherwise require a manual promote).
      const shouldActivate = !prompt.activeVersionId || (created && autoActivate);
      if (shouldActivate && prompt.activeVersionId !== version.id) {
        await this.prompts.update(prompt.id, { activeVersionId: version.id } as any);
      }
    }
  }

  /** Rebuild the in-memory cache of active prompts (compiles templates). */
  async refreshCache(): Promise<void> {
    const next = new Map<string, CacheEntry>();
    for (const p of await this.prompts.findAll()) {
      if (!p.activeVersionId) continue;
      const v = await this.versions.findById(p.activeVersionId);
      if (!v) continue;
      next.set(p.key, {
        key: p.key,
        versionId: v.id,
        version: v.version,
        config: (v.config ?? {}) as PromptConfig,
        render: Handlebars.compile(v.content, { noEscape: true }),
      });
    }
    this.cache = next;
  }

  /** Find the prompts directory across dev (src) and built (dist) layouts. */
  private resolvePromptsDir(): string | null {
    const candidates = [
      path.join(__dirname, '..', 'prompts'), // dist/prompts (assets copied on build)
      path.join(process.cwd(), 'src', 'prompts'), // dev source
      path.join(process.cwd(), 'dist', 'prompts'),
    ];
    return candidates.find((d) => fs.existsSync(d)) ?? null;
  }
}
