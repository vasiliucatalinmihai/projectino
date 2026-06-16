import { Injectable } from '@nestjs/common';
import { AccountRepository, SettingRepository } from '../repository';
import { AI_MODEL_CATALOG_KEY, DEFAULT_MODEL_CATALOG, ModelCatalog } from '../common/ai-catalog';

/**
 * Serves the provider → models catalog that drives the admin dropdowns.
 *
 * Stored as JSON in the system account's `AI_MODEL_CATALOG` setting so it's
 * editable at runtime (Settings UI) without a deploy; falls back to the
 * built-in default when the setting is unset or malformed. Reads go through the
 * repositories — no direct Prisma access.
 */
@Injectable()
export class AiModelCatalogService {
  constructor(
    private readonly settings: SettingRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async get(): Promise<ModelCatalog> {
    const system = await this.accounts.findSystemAccount();
    if (!system) return DEFAULT_MODEL_CATALOG;

    const setting = await this.settings.findByAccountAndKey(system.id, AI_MODEL_CATALOG_KEY);
    return this.parse(setting?.value) ?? DEFAULT_MODEL_CATALOG;
  }

  /** Parse + sanitize the stored JSON into a provider → string[] map. */
  private parse(value?: string | null): ModelCatalog | null {
    if (!value) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const catalog: ModelCatalog = {};
    for (const [provider, models] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(models)) {
        catalog[provider] = models.filter((model): model is string => typeof model === 'string');
      }
    }
    return Object.keys(catalog).length ? catalog : null;
  }
}
