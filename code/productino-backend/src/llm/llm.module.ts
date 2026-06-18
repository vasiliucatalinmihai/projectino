import { Module } from '@nestjs/common';
import { AccountRepository, AiModelRepository } from '../repository';
import {
  AnthropicAdapter,
  DeepSeekAdapter,
  GeminiAdapter,
  OpenAiAdapter,
  QwenAdapter,
} from './adapters';
import { LlmConfigResolverService } from './llm-config-resolver.service';
import { LlmService } from './llm.service';

/**
 * LLM feature module: provider-agnostic prompt execution.
 */
@Module({
  providers: [
    AccountRepository,
    AiModelRepository,
    AnthropicAdapter,
    OpenAiAdapter,
    DeepSeekAdapter,
    QwenAdapter,
    GeminiAdapter,
    LlmConfigResolverService,
    LlmService,
  ],
  exports: [LlmService, LlmConfigResolverService],
})
export class LlmModule {}
