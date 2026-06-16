import { Injectable, Logger } from '@nestjs/common';
import {
  LlmProviderError,
  LlmRequest,
  LlmResult,
  PromptRunner,
  ResolvedLlmConfig,
} from './prompt-runner';
import { LlmConfigResolverService } from './llm-config-resolver.service';
import {
  AnthropicAdapter,
  DeepSeekAdapter,
  GeminiAdapter,
  LlmProviderAdapter,
  OpenAiAdapter,
  QwenAdapter,
} from './adapters';

/**
 * Provider-agnostic entry point for running prompts.
 *
 * Resolves the calling account's effective config (bring-your-own-AI vs the
 * system default), then dispatches to the matching provider adapter. Callers
 * depend on this (the `PromptRunner` port) and never touch a vendor SDK.
 *
 * To add a provider: implement an adapter, register it in LlmModule, and add it
 * to the constructor list below.
 */
@Injectable()
export class LlmService implements PromptRunner {
  private readonly logger = new Logger(LlmService.name);
  private readonly adapters = new Map<string, LlmProviderAdapter>();

  constructor(
    private readonly resolver: LlmConfigResolverService,
    anthropic: AnthropicAdapter,
    openai: OpenAiAdapter,
    deepseek: DeepSeekAdapter,
    qwen: QwenAdapter,
    gemini: GeminiAdapter,
  ) {
    for (const adapter of [anthropic, openai, deepseek, qwen, gemini]) {
      for (const provider of adapter.providers) {
        this.adapters.set(provider.toLowerCase(), adapter);
      }
    }
  }

  /** Resolve the account's effective config, then run the prompt. */
  async run(accountId: number, req: LlmRequest): Promise<LlmResult> {
    const config = await this.resolver.resolve(accountId);
    return this.dispatch(config, req);
  }

  /**
   * Run against an explicitly-supplied config (bypasses resolution). Used to
   * test a specific model's credentials without it being the account's active one.
   */
  runWith(config: ResolvedLlmConfig, req: LlmRequest): Promise<LlmResult> {
    return this.dispatch(config, req);
  }

  private async dispatch(config: ResolvedLlmConfig, req: LlmRequest): Promise<LlmResult> {
    const adapter = this.adapters.get(config.provider.toLowerCase());
    if (!adapter) {
      throw new LlmProviderError(
        `No adapter registered for provider "${config.provider}". ` +
          `Supported: ${[...this.adapters.keys()].join(', ')}.`,
      );
    }

    const { text, usage, finishReason } = await adapter.generate(config, req);
    this.logger.debug(
      `source=${config.source} ${config.provider}/${config.model} ` +
        `in=${usage.tokensIn ?? '?'} out=${usage.tokensOut ?? '?'} stop=${finishReason ?? '?'}`,
    );

    return {
      text,
      provider: config.provider,
      model: config.model,
      source: config.source,
      usage,
      finishReason: finishReason ?? null,
    };
  }
}
