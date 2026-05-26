import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Setting } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class SettingRepository extends PrismaRepository<
  Setting,
  Prisma.SettingCreateInput,
  Prisma.SettingUpdateInput
> {
  protected readonly model = 'setting' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Setting);
  }

  findByKey(key: string): Promise<Setting | null> {
    return this.findUnique({ where: { key } });
  }

  findAllOrdered(): Promise<Setting[]> {
    return this.findMany({ orderBy: { key: 'asc' } });
  }
}
