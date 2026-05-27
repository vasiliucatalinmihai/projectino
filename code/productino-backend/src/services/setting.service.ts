import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SettingRepository } from '../repository';
import { Setting, User } from '../entities';
import { CreateSettingRequest, UpdateSettingRequest } from '../http/request/setting';

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

  /** Read a setting value for an account (for use elsewhere in the app). */
  async getValue(accountId: number, key: string): Promise<string | null> {
    const setting = await this.settings.findByAccountAndKey(accountId, key);
    return setting?.value ?? null;
  }

  async create(body: CreateSettingRequest, user: User): Promise<Setting> {
    if (await this.settings.findByAccountAndKey(user.accountId, body.key)) {
      throw new ConflictException(`Setting "${body.key}" already exists for this account`);
    }
    return this.settings.create({
      key: body.key,
      value: body.value,
      description: body.description ?? null,
      account: { connect: { id: user.accountId } },
    } as any);
  }

  async update(id: number, body: UpdateSettingRequest, user: User): Promise<Setting> {
    await this.findOne(id, user); // enforces account ownership
    return this.settings.update(id, body);
  }

  async remove(id: number, user: User): Promise<Setting> {
    await this.findOne(id, user);
    return this.settings.delete(id);
  }
}
