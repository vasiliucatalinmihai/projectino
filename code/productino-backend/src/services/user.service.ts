import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PermissionKey } from '../common/permission-key';
import { User } from '../entities';
import { AccountRepository, UserRepository } from '../repository';

// Service-level inputs (no HTTP DTOs).
export interface CreateUserInput {
  email: string;
  name?: string | null;
  permissions?: string[];
  accountId?: number;
}
export interface UpdateUserInput {
  name?: string | null;
  permissions?: string[];
  active?: boolean;
  // Move the user to another account (super admin only).
  accountId?: number;
}

/**
 * Manage users within an account. Tenant admins (ADMIN) manage their own
 * account's users; super admins manage any account and may target an accountId.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly accounts: AccountRepository,
  ) {}

  list(actingUser: User, accountId?: number): Promise<User[]> {
    const scope = actingUser.isSuperAdmin ? accountId ?? null : actingUser.accountId;
    return this.users.findForAccount(scope);
  }

  /**
   * Create a user *without* a password — they're inactive and carry a
   * one-shot activation token that the admin shares as a link.
   */
  async create(input: CreateUserInput, actingUser: User): Promise<User> {
    const accountId = this.resolveAccountId(input.accountId, actingUser);
    this.assertAssignable(input.permissions, actingUser);

    if (await this.users.findByEmailWithPermissions(input.email)) {
      throw new ConflictException(`A user with email "${input.email}" already exists`);
    }

    const created = await this.users.create({
      email: input.email,
      name: input.name ?? null,
      passwordHash: null,
      active: false,
      activationToken: this.newToken(),
      account: { connect: { id: accountId } },
      permissions: { connect: (input.permissions ?? []).map((key) => ({ key })) },
    } as any);

    return (await this.users.findByIdWithPermissions(created.id))!;
  }

  async update(id: number, input: UpdateUserInput, actingUser: User): Promise<User> {
    const target = await this.getScoped(id, actingUser);
    this.assertCanManageTarget(target, actingUser);
    this.assertAssignable(input.permissions, actingUser);

    // Self-deactivation lock-out: don't let an admin disable their own login.
    if (input.active === false && target.id === actingUser.id) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const data: Record<string, any> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.permissions) data.permissions = { set: input.permissions.map((key) => ({ key })) };
    if (input.active !== undefined) data.active = input.active;

    // Moving a user across accounts is a super-admin-only action.
    if (input.accountId !== undefined && input.accountId !== target.accountId) {
      if (!actingUser.isSuperAdmin) {
        throw new ForbiddenException('Only a super admin can move a user to another account');
      }
      const destination = await this.accounts.findById(input.accountId);
      if (!destination) {
        throw new BadRequestException(`Account ${input.accountId} not found`);
      }
      data.account = { connect: { id: input.accountId } };
    }

    await this.users.update(id, data as any);
    return (await this.users.findByIdWithPermissions(id))!;
  }

  /**
   * Self-service password reset: the caller clears their own password and gets
   * a fresh activation token so they can set a new one through /activate.
   */
  async resetSelf(actingUser: User): Promise<User> {
    await this.users.update(actingUser.id, {
      passwordHash: null,
      active: false,
      activationToken: this.newToken(),
    } as any);
    return (await this.users.findByIdWithPermissions(actingUser.id))!;
  }

  /**
   * Reset a user's password: clear the current password, mark them inactive,
   * and mint a fresh activation token for the admin to share.
   */
  async resetPassword(id: number, actingUser: User): Promise<User> {
    const target = await this.getScoped(id, actingUser);
    this.assertCanManageTarget(target, actingUser);
    if (target.id === actingUser.id) {
      throw new ForbiddenException('You cannot reset your own password this way');
    }

    await this.users.update(id, {
      passwordHash: null,
      active: false,
      activationToken: this.newToken(),
    } as any);
    return (await this.users.findByIdWithPermissions(id))!;
  }

  async remove(id: number, actingUser: User): Promise<User> {
    const target = await this.getScoped(id, actingUser);
    this.assertCanManageTarget(target, actingUser);
    if (target.id === actingUser.id) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    await this.users.delete(id);
    return target;
  }

  // ── helpers ───────────────────────────────────────────────────

  private newToken(): string {
    // 256 bits of entropy; opaque hex so it's URL-safe.
    return randomBytes(32).toString('hex');
  }

  private resolveAccountId(requested: number | undefined, actingUser: User): number {
    if (actingUser.isSuperAdmin) return requested ?? actingUser.accountId;
    return actingUser.accountId;
  }

  private async getScoped(id: number, actingUser: User): Promise<User> {
    const user = await this.users.findByIdWithPermissions(id);
    if (!user || (!actingUser.isSuperAdmin && user.accountId !== actingUser.accountId)) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  private assertAssignable(permissions: string[] | undefined, actingUser: User): void {
    if (permissions?.includes(PermissionKey.SUPER_ADMIN) && !actingUser.isSuperAdmin) {
      throw new ForbiddenException('Only a super admin can grant SUPER_ADMIN');
    }
  }

  private assertCanManageTarget(target: User, actingUser: User): void {
    if (target.permissionKeys.includes(PermissionKey.SUPER_ADMIN) && !actingUser.isSuperAdmin) {
      throw new ForbiddenException('You cannot modify a super admin');
    }
  }
}
