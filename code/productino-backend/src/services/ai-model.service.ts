import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository, AiModelRepository } from '../repository';
import { AiModel, User } from '../entities';

// The shop's default model, used when an account is not "bring your own AI".
const PLATFORM_PROVIDER = process.env.PLATFORM_AI_PROVIDER || 'anthropic';
const PLATFORM_MODEL = process.env.PLATFORM_AI_MODEL || 'claude-opus-4-7';

// Service-level inputs/outputs (no HTTP DTOs).
export interface CreateAiModelInput {
  label?: string | null;
  provider: string;
  model: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  isActive?: boolean;
}
export interface UpdateAiModelInput {
  label?: string | null;
  provider?: string;
  model?: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  isActive?: boolean;
}
export interface EffectiveModel {
  source: 'account' | 'platform';
  provider: string | null;
  model: string | null;
  configured: boolean;
}

@Injectable()
export class AiModelService {
  constructor(
    private readonly models: AiModelRepository,
    private readonly accounts: AccountRepository,
  ) {}

  findAll(user: User): Promise<AiModel[]> {
    return this.models.findForAccount(user.accountId);
  }

  async findOne(id: number, user: User): Promise<AiModel> {
    const model = await this.models.findById(id);
    if (!model || model.accountId !== user.accountId) {
      throw new NotFoundException(`AI model ${id} not found`);
    }
    return model;
  }

  async create(input: CreateAiModelInput, user: User): Promise<AiModel> {
    const existing = await this.models.count({ where: { accountId: user.accountId } });
    // First model for the account becomes active automatically.
    const makeActive = input.isActive ?? existing === 0;

    const created = await this.models.create({
      label: input.label ?? null,
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey ?? null,
      baseUrl: input.baseUrl ?? null,
      isActive: false,
      account: { connect: { id: user.accountId } },
    } as any);

    if (makeActive) return this.setActive(created.id, user.accountId);
    return created;
  }

  async update(id: number, input: UpdateAiModelInput, user: User): Promise<AiModel> {
    await this.findOne(id, user);

    const data: Record<string, any> = {};
    if (input.label !== undefined) data.label = input.label || null;
    if (input.provider !== undefined) data.provider = input.provider;
    if (input.model !== undefined) data.model = input.model;
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl || null;
    // Only overwrite the credential when a new one is supplied.
    if (input.apiKey !== undefined && input.apiKey !== '') data.apiKey = input.apiKey;

    const updated = await this.models.update(id, data);

    if (input.isActive === true) return this.setActive(id, user.accountId);
    if (input.isActive === false) return this.models.update(id, { isActive: false });
    return updated;
  }

  async activate(id: number, user: User): Promise<AiModel> {
    await this.findOne(id, user);
    return this.setActive(id, user.accountId);
  }

  async remove(id: number, user: User): Promise<AiModel> {
    await this.findOne(id, user);
    return this.models.delete(id);
  }

  /** Which model the account would use to process projects, given its BYO flag. */
  async effectiveForAccount(user: User): Promise<EffectiveModel> {
    const account = await this.accounts.findById(user.accountId);
    if (account?.bringYourOwnAi) {
      const active = await this.models.findActiveForAccount(user.accountId);
      return {
        source: 'account',
        provider: active?.provider ?? null,
        model: active?.model ?? null,
        configured: !!active,
      };
    }
    return {
      source: 'platform',
      provider: PLATFORM_PROVIDER,
      model: PLATFORM_MODEL,
      configured: true,
    };
  }

  // Exactly one active model per account.
  private async setActive(id: number, accountId: number): Promise<AiModel> {
    await this.models.updateMany({ accountId }, { isActive: false });
    return this.models.update(id, { isActive: true });
  }
}
