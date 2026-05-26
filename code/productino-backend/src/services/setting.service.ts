import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SettingRepository } from '../repository';
import { Setting } from '../entities';
import { CreateSettingRequest, UpdateSettingRequest } from '../http/request/setting';

@Injectable()
export class SettingService {
  constructor(private readonly settings: SettingRepository) {}

  findAll(): Promise<Setting[]> {
    return this.settings.findAllOrdered();
  }

  async findOne(id: number): Promise<Setting> {
    const setting = await this.settings.findById(id);
    if (!setting) throw new NotFoundException(`Setting ${id} not found`);
    return setting;
  }

  /** Convenience accessor for reading a setting value elsewhere in the app. */
  async getValue(key: string): Promise<string | null> {
    const setting = await this.settings.findByKey(key);
    return setting?.value ?? null;
  }

  async create(body: CreateSettingRequest): Promise<Setting> {
    if (await this.settings.findByKey(body.key)) {
      throw new ConflictException(`Setting with key "${body.key}" already exists`);
    }
    return this.settings.create(body);
  }

  async update(id: number, body: UpdateSettingRequest): Promise<Setting> {
    await this.findOne(id);
    return this.settings.update(id, body);
  }

  async remove(id: number): Promise<Setting> {
    await this.findOne(id);
    return this.settings.delete(id);
  }
}
