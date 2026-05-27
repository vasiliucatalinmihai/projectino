import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { User } from '../entities';
import { PrismaRepository } from './prisma.repository';

const withRelations = { permissions: true, account: true };

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
    return this.findUnique({ where: { email }, include: withRelations });
  }

  findByIdWithPermissions(id: number): Promise<User | null> {
    return this.findUnique({ where: { id }, include: withRelations });
  }

  /** List users, optionally restricted to one account (null = all accounts). */
  findForAccount(accountId: number | null): Promise<User[]> {
    return this.findMany({
      where: accountId === null ? {} : { accountId },
      include: withRelations,
      orderBy: { email: 'asc' },
    });
  }
}
