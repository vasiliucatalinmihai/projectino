import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SettingRepository } from '../repository';
import { Setting, User } from '../entities';

export interface CreateSettingInput {
  key: string;
  value: string;
  description?: string | null;
}
export interface UpdateSettingInput {
  value?: string;
  description?: string | null;
}

@Injectable()
export class SettingService {
  constructor(private readonly settings: SettingRepository) {}

  findAll(user: User): Promise<Setting[]> {
    return this.settings.findAllForAccount(user.accountId);
  }

  async findOne(id: number, user: User): Promise<Setting> {
    const setting = await this.settings.findById(id);
    if (!setting || setting.accountId !== user.accountId) {
      throw new NotFoundException(`Setting ${id} not found`);
    }
    return setting;
  }

  async getValue(accountId: number, key: string): Promise<string | null> {
    const setting = await this.settings.findByAccountAndKey(accountId, key);
    return setting?.value ?? null;
  }

  async create(input: CreateSettingInput, user: User): Promise<Setting> {
    if (await this.settings.findByAccountAndKey(user.accountId, input.key)) {
      throw new ConflictException(`Setting "${input.key}" already exists for this account`);
    }
    return this.settings.create({
      key: input.key,
      value: input.value,
      description: input.description ?? null,
      account: { connect: { id: user.accountId } },
    } as any);
  }

  async update(id: number, input: UpdateSettingInput, user: User): Promise<Setting> {
    await this.findOne(id, user); // enforces account ownership
    return this.settings.update(id, input as any);
  }

  async remove(id: number, user: User): Promise<Setting> {
    const setting = await this.findOne(id, user);
    await this.settings.delete(id);
    return setting;
  }
}
