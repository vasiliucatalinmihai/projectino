import { Injectable } from '@nestjs/common';
import { AccountRepository, AiModelRepository } from '../repository';
import { AiModel } from '../entities';
import {
  EffectiveModel,
  LlmNotConfiguredError,
  ResolvedLlmConfig,
} from './prompt-runner';

/**
 * Resolves which AI configuration an account runs with:
 *
 *   - Bring-your-own-AI ON  → the account's own active AiModel.
 *   - Bring-your-own-AI OFF → the active AiModel of the system account
 *     (`isSystem = true`). The platform default is stored as an AiModel with
 *     the exact same shape (provider / model / key / baseUrl / options /
 *     isActive), so resolution and the call path are identical either way.
 */
@Injectable()
export class LlmConfigResolverService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly modelRepository: AiModelRepository,
  ) {}

  /** Full runnable config (with credential). Throws if nothing usable is set. */
  async resolve(accountId: number): Promise<ResolvedLlmConfig> {
    const { model, source } = await this.resolveAiModel(accountId);

    if (!model) {
      throw new LlmNotConfiguredError(
        source === 'account'
          ? 'Bring-your-own-AI is enabled but no active model is configured for this account.'
          : 'No system default AI model is configured.',
      );
    }
    if (!model.apiKey) {
      throw new LlmNotConfiguredError(
        `Active ${source} model "${model.provider}/${model.model}" has no API key configured.`,
      );
    }

    return {
      source,
      modelId: model.id,
      provider: model.provider,
      model: model.model,
      // TODO: decrypt here once credentials are stored encrypted at rest.
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      options: (model.options as Record<string, any>) ?? {},
    };
  }

  /** Key-free descriptor for UI/display. Never throws. */
  async describe(accountId: number): Promise<EffectiveModel> {
    const { model, source } = await this.resolveAiModel(accountId);
    return {
      source,
      provider: model?.provider ?? null,
      model: model?.model ?? null,
      configured: !!(model && model.apiKey),
    };
  }

  /** Pick the AiModel an account would use and where it came from. */
  private async resolveAiModel(accountId: number): Promise<{ model: AiModel | null; source: 'account' | 'system' }> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new LlmNotConfiguredError(`Account ${accountId} not found.`);
    }

    if (account.bringYourOwnAi) {
      return { model: await this.modelRepository.findActiveForAccount(accountId), source: 'account' };
    }

    const system = await this.accountRepository.findSystemAccount();
    const model = system ? await this.modelRepository.findActiveForAccount(system.id) : null;
    return { model, source: 'system' };
  }
}
