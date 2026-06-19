import { Injectable, NotFoundException } from '@nestjs/common';
import { AiModelRepository } from '../repository';
import { AiModel, User } from '../entities';
import { LlmConfigResolverService, LlmService } from '../llm';
import type { EffectiveModel, ResolvedLlmConfig } from '../llm';

export type { EffectiveModel };

export interface CreateAiModelInput {
  label?: string | null;
  provider: string;
  model: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  options?: Record<string, any>;
  isActive?: boolean;
  // Super admin only: the account to create the model in. Ignored for tenant
  // admins (they're pinned to their own account).
  accountId?: number;
}
export interface UpdateAiModelInput {
  label?: string | null;
  provider?: string;
  model?: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  options?: Record<string, any>;
  isActive?: boolean;
}
export interface TestConnectionResult {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number | null;
  message: string | null;
}

@Injectable()
export class AiModelService {
  constructor(
    private readonly models: AiModelRepository,
    private readonly resolver: LlmConfigResolverService,
    private readonly llm: LlmService,
  ) {}

  findAll(actingUser: User, accountId?: number): Promise<AiModel[]> {
    return this.models.findForAccount(this.scopeAccountId(actingUser, accountId));
  }

  findOne(id: number, actingUser: User): Promise<AiModel> {
    return this.getScoped(id, actingUser);
  }

  async create(input: CreateAiModelInput, actingUser: User): Promise<AiModel> {
    const accountId = this.scopeAccountId(actingUser, input.accountId);
    const existing = await this.models.count({ where: { accountId } });
    // First model for the account becomes active automatically.
    const makeActive = input.isActive ?? existing === 0;

    const created = await this.models.create({
      label: input.label ?? null,
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey ?? null,
      baseUrl: input.baseUrl ?? null,
      options: input.options ?? {},
      isActive: false,
      account: { connect: { id: accountId } },
    } as any);

    if (makeActive) return this.setActive(created.id, accountId);
    return created;
  }

  async update(id: number, input: UpdateAiModelInput, actingUser: User): Promise<AiModel> {
    const target = await this.getScoped(id, actingUser);

    const data: Record<string, any> = {};
    if (input.label !== undefined) data.label = input.label || null;
    if (input.provider !== undefined) data.provider = input.provider;
    if (input.model !== undefined) data.model = input.model;
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl || null;
    if (input.options !== undefined) data.options = input.options ?? {};
    // Only overwrite the credential when a new one is supplied.
    if (input.apiKey !== undefined && input.apiKey !== '') data.apiKey = input.apiKey;

    const updated = await this.models.update(id, data);

    if (input.isActive === true) return this.setActive(id, target.accountId);
    if (input.isActive === false) return this.models.update(id, { isActive: false });
    return updated;
  }

  async activate(id: number, actingUser: User): Promise<AiModel> {
    const target = await this.getScoped(id, actingUser);
    return this.setActive(id, target.accountId);
  }

  async remove(id: number, actingUser: User): Promise<AiModel> {
    await this.getScoped(id, actingUser);
    return this.models.delete(id);
  }

  /**
   * Which model an account would use to process projects, given its BYO flag.
   */
  effectiveForAccount(actingUser: User, accountId?: number): Promise<EffectiveModel> {
    return this.resolver.describe(this.scopeAccountId(actingUser, accountId));
  }

  /**
   * Validate a model's stored credentials with a tiny live call
   */
  async testConnection(id: number, actingUser: User): Promise<TestConnectionResult> {
    const model = await this.getScoped(id, actingUser);
    const base: TestConnectionResult = {
      ok: false,
      provider: model.provider,
      model: model.model,
      latencyMs: null,
      message: null,
    };
    if (!model.apiKey) {
      return { ...base, message: 'No API key configured on this model.' };
    }

    const config: ResolvedLlmConfig = {
      source: 'account',
      modelId: model.id,
      provider: model.provider,
      model: model.model,
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      options: (model.options as Record<string, any>) ?? {},
    };

    const startedAt = Date.now();
    try {
      await this.llm.runWith(config, {
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        maxTokens: 16,
      });
      return { ...base, ok: true, latencyMs: Date.now() - startedAt };
    } catch (error: any) {
      return { ...base, latencyMs: Date.now() - startedAt, message: error?.message ?? String(error) };
    }
  }

  // ── helpers ─────────────────────────────────────────────────────

  // Which account an operation applies to: super admins may target any account;
  // tenant users are pinned to their own (a requested accountId is ignored).
  private scopeAccountId(actingUser: User, requested?: number): number {
    return actingUser.isSuperAdmin ? requested ?? actingUser.accountId : actingUser.accountId;
  }

  private async getScoped(id: number, actingUser: User): Promise<AiModel> {
    const model = await this.models.findById(id);
    if (!model || (!actingUser.isSuperAdmin && model.accountId !== actingUser.accountId)) {
      throw new NotFoundException(`AI model ${id} not found`);
    }
    return model;
  }

  private async setActive(id: number, accountId: number): Promise<AiModel> {
    await this.models.updateMany({ accountId }, { isActive: false });
    return this.models.update(id, { isActive: true });
  }
}
