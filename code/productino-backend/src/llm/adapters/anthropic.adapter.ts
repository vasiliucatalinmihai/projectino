import { Injectable } from '@nestjs/common';
import { LlmRequest, ResolvedLlmConfig } from '../prompt-runner';
import { AdapterResult, BaseLlmAdapter } from './llm-provider.adapter';

/**
 * Anthropic deprecated the `temperature` parameter on its 4.x-generation models
 * — sending it returns a 400. Matches claude-opus-4-x / sonnet-4-x / haiku-4-x.
 */
const TEMPERATURE_DEPRECATED = /claude-(opus|sonnet|haiku)-4|claude-4/i;

/**
 * Anthropic Messages API adapter (`POST /v1/messages`).
 *
 * Zero-dependency over `fetch`. Two upgrades over plain text generation:
 *  - **Strict structured output** via tool-use: when `req.responseSchema` is set,
 *    a tool with that JSON Schema is forced and the parsed `tool_use.input` is
 *    returned (no JSON-from-prose parsing).
 *  - **Prompt caching**: the system block is marked `cache_control: ephemeral`
 *    so a reused prefix isn't re-billed (Anthropic caches ≥1024-token prefixes).
 */
@Injectable()
export class AnthropicAdapter extends BaseLlmAdapter {
  readonly providers = ['anthropic'];

  async generate(config: ResolvedLlmConfig, req: LlmRequest): Promise<AdapterResult> {
    const base = this.trimSlash(config.baseUrl || 'https://api.anthropic.com');

    // Anthropic takes `system` at the top level; fold any system-role messages in.
    const messages: Array<{ role: string; content: string }> = [];
    const systemParts: string[] = [];
    for (const message of req.messages) {
      if (message.role === 'system') systemParts.push(message.content);
      else messages.push({ role: message.role, content: message.content });
    }
    // With tool-use we don't need a "respond in JSON" nudge.
    if (req.json && !req.responseSchema) {
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

    // Strict structured output: force a single tool call shaped by the schema.
    if (req.responseSchema) {
      body.tools = [
        {
          name: req.responseSchema.name,
          description: req.responseSchema.description ?? 'Return the structured result.',
          input_schema: req.responseSchema.schema,
        },
      ];
      body.tool_choice = { type: 'tool', name: req.responseSchema.name };
    }

    // System prompt — cached so a reused prefix isn't re-billed.
    const systemText = [body.system, req.system, ...systemParts].filter(Boolean).join('\n\n');
    if (systemText) {
      body.system = [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }];
    } else {
      delete body.system;
    }

    // Skip `temperature` on models that deprecated it (they 400 if it's present).
    if (req.temperature !== undefined && !TEMPERATURE_DEPRECATED.test(config.model)) {
      body.temperature = req.temperature;
    }

    const data = await this.postJson(
      `${base}/v1/messages`,
      {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body,
    );

    const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
    // Prefer the tool_use input (already structured); else concatenate text.
    const toolUse = blocks.find((b) => b?.type === 'tool_use' && b?.input);
    const text = toolUse
      ? JSON.stringify(toolUse.input)
      : blocks
          .filter((b) => b?.type === 'text')
          .map((b) => b.text)
          .join('');

    return {
      text,
      usage: {
        tokensIn: data?.usage?.input_tokens ?? null,
        tokensOut: data?.usage?.output_tokens ?? null,
      },
      finishReason: data?.stop_reason ?? null,
    };
  }
}
