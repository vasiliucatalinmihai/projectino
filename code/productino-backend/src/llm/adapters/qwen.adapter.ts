import { Injectable } from '@nestjs/common';
import { OpenAiAdapter } from './openai.adapter';

/**
 * Qwen (Alibaba) adapter.
 * Qwen is served through Alibaba Cloud DashScope's OpenAI-compatible endpoint,
 */
@Injectable()
export class QwenAdapter extends OpenAiAdapter {
  readonly providers = ['qwen'];

  protected defaultBaseUrl(): string {
    return 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  }
}
