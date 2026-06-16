import { LlmProviderError, LlmRequest, LlmUsage, ResolvedLlmConfig } from '../prompt-runner';

export interface AdapterResult {
  text: string;
  usage: LlmUsage;
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

/** Shared HTTP plumbing for fetch-based adapters. */
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
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      throw new LlmProviderError(`Network error calling ${url}: ${e?.message ?? e}`);
    }

    const raw = await res.text();
    if (!res.ok) {
      throw new LlmProviderError(`Provider returned ${res.status}: ${raw.slice(0, 800)}`);
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new LlmProviderError(`Provider returned a non-JSON body: ${raw.slice(0, 300)}`);
    }
  }
}
