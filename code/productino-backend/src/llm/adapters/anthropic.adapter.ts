import { Injectable } from '@nestjs/common';
import { LlmRequest, ResolvedLlmConfig } from '../prompt-runner';
import { AdapterResult, BaseLlmAdapter } from './llm-provider.adapter';

/**
 * Anthropic Messages API adapter (`POST /v1/messages`).
 *
 * Zero-dependency over `fetch`. The system prompt goes at the top level (not as
 * a message); the model's stored `options` and the per-call `options` are
 * spread into the body so advanced features (output_config, thinking, …) work
 * without this adapter modelling each one.
 */
@Injectable()
export class AnthropicAdapter extends BaseLlmAdapter {
  readonly providers = ['anthropic'];

  async generate(config: ResolvedLlmConfig, req: LlmRequest): Promise<AdapterResult> {
    const base = this.trimSlash(config.baseUrl || 'https://api.anthropic.com');

    // Anthropic takes `system` at the top level; fold any system-role messages in.
    const messages: Array<{ role: string; content: string }> = [];
    const systemParts: string[] = [];
    for (const m of req.messages) {
      if (m.role === 'system') systemParts.push(m.content);
      else messages.push({ role: m.role, content: m.content });
    }
    if (req.json) {
      systemParts.push('Respond with only a single valid JSON object and no other text.');
    }

    const body: Record<string, any> = {
      ...config.options,
      ...(req.options ?? {}),
      // Managed fields are set last so stored options can't clobber them.
      model: config.model,
      max_tokens: req.maxTokens ?? config.options?.max_tokens ?? req.options?.max_tokens ?? 4096,
      messages,
    };

    const system = [body.system, req.system, ...systemParts].filter(Boolean);
    if (system.length) body.system = system.join('\n\n');
    else delete body.system;

    if (req.temperature !== undefined) body.temperature = req.temperature;

    const data = await this.postJson(
      `${base}/v1/messages`,
      {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    );

    const text = Array.isArray(data?.content)
      ? data.content
          .filter((b: any) => b?.type === 'text')
          .map((b: any) => b.text)
          .join('')
      : '';

    return {
      text,
      usage: {
        tokensIn: data?.usage?.input_tokens ?? null,
        tokensOut: data?.usage?.output_tokens ?? null,
      },
    };
  }
}
