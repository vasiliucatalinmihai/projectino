import { LlmProviderError, LlmRequest, LlmUsage, ResolvedLlmConfig } from '../prompt-runner';

export interface AdapterResult {
  text: string;
  usage: LlmUsage;
  /** Provider's stop/finish reason, normalized to a lowercase string when present. */
  finishReason?: string | null;
}

/**
 * One concrete provider integration. `providers` lists the provider keys this
 * adapter answers for (e.g. the OpenAI adapter also serves OpenAI-compatible
 * `deepseek`). `LlmService` builds a provider → adapter map from these.
 */
export interface LlmProviderAdapter {
  readonly providers: string[];
  generate(config: ResolvedLlmConfig, req: LlmRequest): Promise<AdapterResult>;
}

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 60_000;
const MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES ?? 2);

/** Shared HTTP plumbing for fetch-based adapters: timeout + transient-retry. */
export abstract class BaseLlmAdapter implements LlmProviderAdapter {
  abstract readonly providers: string[];
  abstract generate(config: ResolvedLlmConfig, req: LlmRequest): Promise<AdapterResult>;

  /** Drop a trailing slash so a path can be appended safely. */
  protected trimSlash(url: string): string {
    return url.replace(/\/+$/, '');
  }

  protected async postJson(
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<any> {
    for (let attempt = 1; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (e: any) {
        clearTimeout(timer);
        const timedOut = e?.name === 'AbortError';
        const error = new LlmProviderError(
          timedOut
            ? `Request to ${url} timed out after ${TIMEOUT_MS}ms`
            : `Network error calling ${url}: ${e?.message ?? e}`,
          { retryable: true },
        );
        if (attempt <= MAX_RETRIES) {
          await this.backoff(attempt);
          continue;
        }
        throw error;
      }
      clearTimeout(timer);

      const raw = await res.text();
      if (!res.ok) {
        const retryAfter = this.parseRetryAfter(res.headers.get('retry-after'));
        const error = new LlmProviderError(`Provider returned ${res.status}: ${raw.slice(0, 800)}`, {
          status: res.status,
          retryAfter,
        });
        if (error.retryable && attempt <= MAX_RETRIES) {
          await this.backoff(attempt, retryAfter);
          continue;
        }
        throw error;
      }

      try {
        return JSON.parse(raw);
      } catch {
        throw new LlmProviderError(`Provider returned a non-JSON body: ${raw.slice(0, 300)}`);
      }
    }
  }

  private backoff(attempt: number, retryAfterSec?: number): Promise<void> {
    const base = retryAfterSec ? retryAfterSec * 1000 : Math.min(8000, 400 * 2 ** (attempt - 1));
    const jitter = Math.random() * 250;
    return new Promise((resolve) => setTimeout(resolve, base + jitter));
  }

  private parseRetryAfter(header: string | null): number | undefined {
    if (!header) return undefined;
    const seconds = Number(header);
    return Number.isFinite(seconds) ? seconds : undefined;
  }
}
