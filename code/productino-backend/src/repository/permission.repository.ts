import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Permission } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class PermissionRepository extends PrismaRepository<
  Permission,
  Prisma.PermissionCreateInput,
  Prisma.PermissionUpdateInput
> {
  protected readonly model = 'permission' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Permission);
  }

  findAllOrdered(): Promise<Permission[]> {
    return this.findMany({ orderBy: { key: 'asc' } });
  }
}
