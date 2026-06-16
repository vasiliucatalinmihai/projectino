import { Injectable } from '@nestjs/common';
import { LlmRequest, ResolvedLlmConfig } from '../prompt-runner';
import { AdapterResult, BaseLlmAdapter } from './llm-provider.adapter';

/**
 * OpenAI Chat Completions adapter (`POST /chat/completions`).
 *
 * The base for OpenAI-compatible providers: subclass it and override
 * `providers` + `defaultBaseUrl()` to add one (see DeepSeekAdapter). Any
 * OpenAI-compatible endpoint also works on this adapter directly by setting an
 * explicit `baseUrl` on the model.
 */
@Injectable()
export class OpenAiAdapter extends BaseLlmAdapter {
  readonly providers = ['openai'];

  /** Default endpoint when the model has no explicit `baseUrl`. */
  protected defaultBaseUrl(): string {
    return 'https://api.openai.com/v1';
  }

  async generate(config: ResolvedLlmConfig, req: LlmRequest): Promise<AdapterResult> {
    const base = this.trimSlash(config.baseUrl || this.defaultBaseUrl());

    const messages: Array<{ role: string; content: string }> = [];
    if (req.system) messages.push({ role: 'system', content: req.system });
    for (const m of req.messages) messages.push({ role: m.role, content: m.content });

    const body: Record<string, any> = {
      ...config.options,
      ...(req.options ?? {}),
      model: config.model,
      messages,
    };
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.json) body.response_format = { type: 'json_object' };

    const data = await this.postJson(
      `${base}/chat/completions`,
      {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body,
    );

    return {
      text: data?.choices?.[0]?.message?.content ?? '',
      usage: {
        tokensIn: data?.usage?.prompt_tokens ?? null,
        tokensOut: data?.usage?.completion_tokens ?? null,
      },
      // OpenAI-compatible: 'stop' | 'length' | 'content_filter' | 'tool_calls'
      finishReason: data?.choices?.[0]?.finish_reason ?? null,
    };
  }
}
