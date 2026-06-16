import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Account } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class AccountRepository extends PrismaRepository<
  Account,
  Prisma.AccountCreateInput,
  Prisma.AccountUpdateInput
> {
  protected readonly model = 'account' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Account);
  }

  findAllOrdered(): Promise<Account[]> {
    return this.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] });
  }

  findSystemAccount(): Promise<Account | null> {
    return this.findFirst({ where: { isSystem: true } });
  }
}
