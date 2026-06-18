import { LlmProviderError, LlmRequest, LlmUsage, ResolvedLlmConfig } from '../prompt-runner';

export interface AdapterResult {
  text: string;
  usage: LlmUsage;
  /** Provider's stop/finish reason, normalized to a lowercase string when present. */
  finishReason?: string | null;
}

export interface LlmProviderAdapter {
  readonly providers: string[];
  generate(config: ResolvedLlmConfig, req: LlmRequest): Promise<AdapterResult>;
}

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 60_000;
const MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES ?? 2);

/** Shared HTTP for fetch-based adapters: timeout + retry. */
export abstract class BaseLlmAdapter implements LlmProviderAdapter {
  abstract readonly providers: string[];
  abstract generate(config: ResolvedLlmConfig, req: LlmRequest): Promise<AdapterResult>;

  protected trimSlash(url: string): string {
    return url.replace(/\/+$/, '');
  }

  protected async postJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
    for (let attempt = 1; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal});
      } catch (exception: any) {
        clearTimeout(timer);
        const timedOut = exception?.name === 'AbortError';
        const error = new LlmProviderError(
          timedOut
            ? `Request to ${url} timed out after ${TIMEOUT_MS}ms`
            : `Network error calling ${url}: ${exception?.message ?? exception}`,
          { retryable: true },
        );
        if (attempt <= MAX_RETRIES) {
          await this.backoff(attempt);
          continue;
        }
        throw error;
      }
      clearTimeout(timer);

      const rawResponse = await response.text();
      if (!response.ok) {
        const retryAfter = this.parseRetryAfter(response.headers.get('retry-after'));
        const error = new LlmProviderError(`Provider returned ${response.status}: ${rawResponse.slice(0, 800)}`, {
          status: response.status,
          retryAfter,
        });
        if (error.retryable && attempt <= MAX_RETRIES) {
          await this.backoff(attempt, retryAfter);
          continue;
        }
        throw error;
      }

      try {
        return JSON.parse(rawResponse);
      } catch {
        throw new LlmProviderError(`Provider returned a non-JSON body: ${rawResponse.slice(0, 300)}`);
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
