import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository, UserRepository } from '../repository';
import { Account } from '../entities';
import { PermissionKey } from '../common/permission-key';
import { AccountResponse } from '../http/response/account';
import { LoginResponse } from '../http/response/auth';
import { CreateAccountRequest, UpdateAccountRequest } from '../http/request/account';
import { AuthService } from './auth.service';

/** Tenant (account) management — SUPER_ADMIN only (gated at the controller). */
@Injectable()
export class AccountService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly users: UserRepository,
    private readonly auth: AuthService,
  ) {}

  async list(): Promise<AccountResponse[]> {
    const accounts = await this.accounts.findAllOrdered();
    return Promise.all(
      accounts.map(async (a) =>
        AccountResponse.fromEntity(a, await this.users.count({ where: { accountId: a.id } })),
      ),
    );
  }

  async getOne(id: number): Promise<AccountResponse> {
    const account = await this.getOrThrow(id);
    const userCount = await this.users.count({ where: { accountId: id } });
    return AccountResponse.fromEntity(account, userCount);
  }

  private async getOrThrow(id: number): Promise<Account> {
    const account = await this.accounts.findById(id);
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  async create(body: CreateAccountRequest): Promise<AccountResponse> {
    const account = await this.accounts.create({ name: body.name, slug: body.slug ?? null } as any);
    return AccountResponse.fromEntity(account, 0);
  }

  async update(id: number, body: UpdateAccountRequest): Promise<AccountResponse> {
    await this.getOrThrow(id);
    const account = await this.accounts.update(id, body);
    const userCount = await this.users.count({ where: { accountId: id } });
    return AccountResponse.fromEntity(account, userCount);
  }

  async remove(id: number): Promise<AccountResponse> {
    const account = await this.getOrThrow(id);
    if (account.isSystem) {
      throw new BadRequestException('The system account cannot be deleted');
    }
    await this.accounts.delete(id); // cascades to its users/projects/settings
    return AccountResponse.fromEntity(account, 0);
  }

  /**
   * Issue a session token as a user inside the given account, so a super admin
   * can "enter" a tenant. Prefers an ADMIN of that account, falling back to its
   * first user.
   */
  async impersonate(id: number): Promise<LoginResponse> {
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
