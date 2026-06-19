import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository, UserRepository } from '../repository';
import { Account } from '../entities';
import { PermissionKey } from '../common/permission-key';
import { AuthService, IssuedToken } from './auth.service';

export interface CreateAccountInput {
  name: string;
  slug?: string | null;
}
export interface UpdateAccountInput {
  name?: string;
  slug?: string | null;
  bringYourOwnAi?: boolean;
}
export interface AccountWithStats {
  account: Account;
  userCount: number;
}

@Injectable()
export class AccountService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly users: UserRepository,
    private readonly auth: AuthService,
  ) {}

  async list(): Promise<AccountWithStats[]> {
    const accounts = await this.accounts.findAllOrdered();
    return Promise.all(
      accounts.map(async (account) => ({
        account,
        userCount: await this.users.count({ where: { accountId: account.id } }),
      })),
    );
  }

  async getOne(id: number): Promise<AccountWithStats> {
    const account = await this.getOrThrow(id);
    const userCount = await this.users.count({ where: { accountId: id } });
    return { account, userCount };
  }

  private async getOrThrow(id: number): Promise<Account> {
    const account = await this.accounts.findById(id);
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  create(input: CreateAccountInput): Promise<Account> {
    return this.accounts.create({ name: input.name, slug: input.slug ?? null } as any);
  }

  async update(id: number, input: UpdateAccountInput): Promise<AccountWithStats> {
    await this.getOrThrow(id);
    const account = await this.accounts.update(id, input);
    const userCount = await this.users.count({ where: { accountId: id } });
    return { account, userCount };
  }

  async remove(id: number): Promise<Account> {
    const account = await this.getOrThrow(id);
    if (account.isSystem) {
      throw new BadRequestException('The system account cannot be deleted');
    }
    await this.accounts.delete(id); // cascades to its users/projects/settings
    return account;
  }

  async impersonate(id: number): Promise<IssuedToken> {
    const account = await this.getOrThrow(id);
    const users = await this.users.findForAccount(id);
    const target =
      users.find((u) => u.permissionKeys.includes(PermissionKey.ADMIN)) ?? users[0];
    if (!target) {
      throw new BadRequestException(`Account "${account.name}" has no users to impersonate`);
    }
    return this.auth.issueToken(target);
  }
}
