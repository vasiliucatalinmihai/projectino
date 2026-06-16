import { Injectable } from '@nestjs/common';
import { OpenAiAdapter } from './openai.adapter';

/**
 * Qwen (Alibaba) adapter.
 *
 * Qwen is served through Alibaba Cloud DashScope's OpenAI-compatible endpoint,
 * so it reuses the OpenAI adapter's request/response handling and only changes
 * the provider key and default endpoint. Defaults to the international
 * (Singapore) region; set an explicit `baseUrl` on the model for the China
 * region — `https://dashscope.aliyuncs.com/compatible-mode/v1`.
 */
@Injectable()
export class QwenAdapter extends OpenAiAdapter {
  readonly providers = ['qwen'];

  protected defaultBaseUrl(): string {
    return 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  }
}
