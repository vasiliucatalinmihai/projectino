/**
 * The provider-agnostic LLM port the rest of the app codes against.
 *
 * Callers (belief extraction, coverage scoring, PRD synthesis, …) depend only on `PromptRunner` and
 * never import a vendor SDK. `LlmService` implements this; per-account provider
 * resolution and the concrete HTTP adapters live behind it. Swapping the
 * adapter layer (e.g. for the Vercel AI SDK) is invisible to callers.
 */

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmRequest {
  /** Optional system prompt. Adapters place it where the provider expects. */
  system?: string;
  messages: LlmMessage[];
  /** Hard cap on output tokens. Adapter applies a sane default if omitted. */
  maxTokens?: number;
  temperature?: number;
  /** Best-effort: ask the provider to return a single JSON object. */
  json?: boolean;
  /**
   * Per-call provider passthrough, merged *over* the model's stored `options`.
   * Lets advanced callers set provider-specific knobs (e.g. Anthropic
   * `output_config` / `thinking`, OpenAI `response_format`) without the port
   * needing to model every feature.
   */
  options?: Record<string, any>;
}

export interface LlmUsage {
  tokensIn: number | null;
  tokensOut: number | null;
}

/** Which configuration produced a call: the account's own, or the platform default. */
export type LlmConfigSource = 'account' | 'system';

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  source: LlmConfigSource;
  usage: LlmUsage;
}

/**
 * A fully-resolved, runnable model config (includes the decrypted credential).
 * Produced by LlmConfigResolverService; consumed by the adapters. Never expose
 * this over HTTP — use `EffectiveModel` for that.
 */
export interface ResolvedLlmConfig {
  source: LlmConfigSource;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  options: Record<string, any>;
}

/** Safe, key-free descriptor of the model an account would use. For UI/display. */
export interface EffectiveModel {
  source: LlmConfigSource;
  provider: string | null;
  model: string | null;
  /** False when the resolved model is missing or has no credential. */
  configured: boolean;
}

/** The port. `LlmService` is the implementation. */
export interface PromptRunner {
  run(accountId: number, req: LlmRequest): Promise<LlmResult>;
}

// ── Errors ──────────────────────────────────────────────────────────────────

/** No runnable model for the account (BYO on with nothing active, or no system default). */
export class LlmNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmNotConfiguredError';
  }
}

/** The upstream provider rejected the call or returned an unusable response. */
export class LlmProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
