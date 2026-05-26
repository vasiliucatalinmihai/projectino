import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { User } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class UserRepository extends PrismaRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  protected readonly model = 'user' as const;

  constructor(prisma: PrismaService) {
    super(prisma, User);
  }

  findByEmailWithPermissions(email: string): Promise<User | null> {
    return this.findUnique({ where: { email }, include: { permissions: true } });
  }

  findByIdWithPermissions(id: number): Promise<User | null> {
    return this.findUnique({ where: { id }, include: { permissions: true } });
  }
}
