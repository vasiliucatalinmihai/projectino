import { Injectable } from '@nestjs/common';
import { OpenAiAdapter } from './openai.adapter';

/**
 * DeepSeek adapter.
 *
 * DeepSeek is wire-compatible with OpenAI's Chat Completions API, so this
 * reuses the OpenAI adapter's request/response handling and only changes the
 * provider key and default endpoint. Kept as its own class (rather than a
 * second entry on the OpenAI adapter) so it's discoverable and can diverge if
 * DeepSeek adds non-OpenAI behaviour.
 */
@Injectable()
export class DeepSeekAdapter extends OpenAiAdapter {
  readonly providers = ['deepseek'];

  protected defaultBaseUrl(): string {
    return 'https://api.deepseek.com/v1';
  }
}
