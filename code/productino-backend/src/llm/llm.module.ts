import { Module } from '@nestjs/common';
import { AccountRepository, AiModelRepository } from '../repository';
import {
  AnthropicAdapter,
  DeepSeekAdapter,
  OpenAiAdapter,
  QwenAdapter,
} from './adapters';
import { LlmConfigResolverService } from './llm-config-resolver.service';
import { LlmService } from './llm.service';

/**
 * LLM feature module: provider-agnostic prompt execution.
 *
 * PrismaService comes from the global PrismaModule, so the repositories below
 * share the app's single connection pool. Exports the runner (`LlmService`) and
 * the resolver so other parts of the app — e.g. AiModelService's "effective
 * model" lookup — can reuse the one resolution path.
 */
@Module({
  providers: [
    AccountRepository,
    AiModelRepository,
    AnthropicAdapter,
    OpenAiAdapter,
    DeepSeekAdapter,
    QwenAdapter,
    LlmConfigResolverService,
    LlmService,
  ],
  exports: [LlmService, LlmConfigResolverService],
})
export class LlmModule {}
