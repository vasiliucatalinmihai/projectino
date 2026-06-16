/**
 * What each provider can do, so the structured runner adapts without the prompts
 * caring. `maxOutputTokens` lets us clamp a prompt's requested cap to the
 * provider's hard limit (Qwen rejects > 8192). `structuredOutput` says how to
 * force JSON; `promptCache` enables Anthropic prefix caching. Validation + repair
 * is the universal fallback regardless.
 */
export type StructuredOutputMode =
  | 'tool' // Anthropic tool-use with an input schema (strict)
  | 'json' // native JSON mode (OpenAI response_format / Gemini responseMimeType)
  | 'none';

export interface ProviderCapabilities {
  maxOutputTokens: number;
  structuredOutput: StructuredOutputMode;
  promptCache: boolean;
}

const DEFAULTS: ProviderCapabilities = {
  maxOutputTokens: 4096,
  structuredOutput: 'json',
  promptCache: false,
};

const TABLE: Record<string, ProviderCapabilities> = {
  anthropic: { maxOutputTokens: 8192, structuredOutput: 'tool', promptCache: true },
  openai: { maxOutputTokens: 16384, structuredOutput: 'json', promptCache: false },
  deepseek: { maxOutputTokens: 8192, structuredOutput: 'json', promptCache: false },
  qwen: { maxOutputTokens: 8192, structuredOutput: 'json', promptCache: false },
  gemini: { maxOutputTokens: 8192, structuredOutput: 'json', promptCache: false },
  google: { maxOutputTokens: 8192, structuredOutput: 'json', promptCache: false },
};

export function capabilitiesFor(provider: string): ProviderCapabilities {
  return TABLE[(provider ?? '').toLowerCase()] ?? DEFAULTS;
}
