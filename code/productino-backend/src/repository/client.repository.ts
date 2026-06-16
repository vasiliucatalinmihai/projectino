import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Client } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class ClientRepository extends PrismaRepository<
  Client,
  Prisma.ClientCreateInput,
  Prisma.ClientUpdateInput
> {
  protected readonly model = 'client' as const;

  constructor(prisma: PrismaService) {
    super(prisma, Client);
  }

  /** List clients, optionally restricted to one account (null = all accounts). */
  findForAccount(accountId: number | null): Promise<Client[]> {
    return this.findMany({
      where: accountId === null ? {} : { accountId },
      orderBy: { name: 'asc' },
    });
  }

  findByAccountAndName(accountId: number, name: string): Promise<Client | null> {
    return this.findFirst({ where: { accountId, name } });
  }
}
