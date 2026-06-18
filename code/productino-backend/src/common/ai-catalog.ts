/**
 * @todo pull from providers
 *
 * AI model catalog: provider → selectable model IDs, used to populate the admin
 * dropdowns in the frontend.
 *
 * The live catalog is stored as JSON in the **system account's**
 * `AI_MODEL_CATALOG` setting, so super admins can edit it at runtime (via the
 * Settings UI) without a deploy. This constant is the fallback used when that
 * setting is missing or invalid. Keep it in sync with prisma/seed.ts.
 */
export const AI_MODEL_CATALOG_KEY = 'AI_MODEL_CATALOG';

export type ModelCatalog = Record<string, string[]>;

export const DEFAULT_MODEL_CATALOG: ModelCatalog = {
  anthropic: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-72b-instruct'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
};
