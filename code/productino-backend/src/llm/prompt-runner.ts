
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
  /**
   * Provider-agnostic request for strict structured output. When set, capable
   * adapters force the model to emit JSON matching this JSON Schema (Anthropic
   * tool-use, OpenAI json_schema, …). Weaker providers ignore it and rely on
   * JSON mode + the caller's validate/repair loop.
   */
  responseSchema?: { name: string; description?: string; schema: Record<string, any> };
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
  /** Why the model stopped — `length`/`max_tokens` signals a truncated response. */
  finishReason?: string | null;
}

/**
 * A fully-resolved, runnable model config (includes the decrypted credential).
 */
export interface ResolvedLlmConfig {
  source: LlmConfigSource;
  /** The AiModel row this resolved to, so callers can attribute usage to it. */
  modelId: number | null;
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

/** The provider rejected the call or returned an unusable response. */
export class LlmProviderError extends Error {
  /** HTTP status from the provider */
  readonly status?: number;
  /** Seconds to wait before retrying */
  readonly retryAfter?: number;
  /** Transient failures (429 / 5xx / network) are safe to retry with backoff. */
  readonly retryable: boolean;

  constructor(message: string, opts: { status?: number; retryAfter?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'LlmProviderError';
    this.status = opts.status;
    this.retryAfter = opts.retryAfter;
    this.retryable =
      opts.retryable ?? (opts.status === 429 || (opts.status !== undefined && opts.status >= 500));
  }
}
