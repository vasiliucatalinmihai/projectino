import { Injectable } from '@nestjs/common';
import { LlmRequest, ResolvedLlmConfig } from '../prompt-runner';
import { AdapterResult, BaseLlmAdapter } from './llm-provider.adapter';

/**
 * Google Gemini adapter (Generative Language API, `:generateContent`).
 *
 * Zero-dependency over `fetch`. The system prompt maps to `systemInstruction`;
 * `assistant` messages map to Gemini's `model` role. JSON output is requested
 * via `responseMimeType: application/json` (shape is enforced by the caller's
 * validate/repair loop).
 */
@Injectable()
export class GeminiAdapter extends BaseLlmAdapter {
  readonly providers = ['gemini', 'google'];

  async generate(config: ResolvedLlmConfig, req: LlmRequest): Promise<AdapterResult> {
    const base = this.trimSlash(config.baseUrl || 'https://generativelanguage.googleapis.com');

    const systemParts: string[] = [];
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    if (req.system) systemParts.push(req.system);
    for (const message of req.messages) {
      if (message.role === 'system') {
        systemParts.push(message.content);
      } else {
        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        });
      }
    }

    const generationConfig: Record<string, any> = {
      ...(config.options?.generationConfig ?? {}),
      ...(req.options?.generationConfig ?? {}),
    };
    if (req.maxTokens !== undefined) generationConfig.maxOutputTokens = req.maxTokens;
    if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
    if (req.json) generationConfig.responseMimeType = 'application/json';

    const body: Record<string, any> = { contents, generationConfig };
    if (systemParts.length) body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };

    const data = await this.postJson(
      `${base}/v1beta/models/${config.model}:generateContent`,
      { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey },
      body,
    );

    const candidate = data?.candidates?.[0];
    const text = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts.map((part: any) => part?.text ?? '').join('')
      : '';

    return {
      text,
      usage: {
        tokensIn: data?.usageMetadata?.promptTokenCount ?? null,
        tokensOut: data?.usageMetadata?.candidatesTokenCount ?? null,
      },
      finishReason: (candidate?.finishReason ?? '').toLowerCase() || null,
    };
  }
}
