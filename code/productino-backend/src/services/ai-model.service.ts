import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository, AiModelRepository } from '../repository';
import { AiModel, User } from '../entities';
import { EffectiveModelResponse } from '../http/response/ai-model';
import { CreateAiModelRequest, UpdateAiModelRequest } from '../http/request/ai-model';

// The shop's default model, used when an account is not "bring your own AI".
const PLATFORM_PROVIDER = process.env.PLATFORM_AI_PROVIDER || 'anthropic';
const PLATFORM_MODEL = process.env.PLATFORM_AI_MODEL || 'claude-opus-4-7';

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

  async create(body: CreateAiModelRequest, user: User): Promise<AiModel> {
    const existing = await this.models.count({ where: { accountId: user.accountId } });
    // First model for the account becomes active automatically.
    const makeActive = body.isActive ?? existing === 0;

    const created = await this.models.create({
      label: body.label ?? null,
      provider: body.provider,
      model: body.model,
      apiKey: body.apiKey ?? null,
      baseUrl: body.baseUrl ?? null,
      isActive: false,
      account: { connect: { id: user.accountId } },
    } as any);

    if (makeActive) return this.setActive(created.id, user.accountId);
    return created;
  }

  async update(id: number, body: UpdateAiModelRequest, user: User): Promise<AiModel> {
    await this.findOne(id, user);

    const data: Record<string, any> = {};
    if (body.label !== undefined) data.label = body.label || null;
    if (body.provider !== undefined) data.provider = body.provider;
    if (body.model !== undefined) data.model = body.model;
    if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl || null;
    // Only overwrite the credential when a new one is supplied.
    if (body.apiKey !== undefined && body.apiKey !== '') data.apiKey = body.apiKey;

    const updated = await this.models.update(id, data);

    if (body.isActive === true) return this.setActive(id, user.accountId);
    if (body.isActive === false) return this.models.update(id, { isActive: false });
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
  async effectiveForAccount(user: User): Promise<EffectiveModelResponse> {
    const account = await this.accounts.findById(user.accountId);
    if (account?.bringYourOwnAi) {
      const active = await this.models.findActiveForAccount(user.accountId);
      return new EffectiveModelResponse({
        source: 'account',
        provider: active?.provider ?? null,
        model: active?.model ?? null,
        configured: !!active,
      });
    }
    return new EffectiveModelResponse({
      source: 'platform',
      provider: PLATFORM_PROVIDER,
      model: PLATFORM_MODEL,
      configured: true,
    });
  }

  // Exactly one active model per account.
  private async setActive(id: number, accountId: number): Promise<AiModel> {
    await this.models.updateMany({ accountId }, { isActive: false });
    return this.models.update(id, { isActive: true });
  }
}
