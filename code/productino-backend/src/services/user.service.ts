import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PermissionKey } from '../common/permission-key';
import { User } from '../entities';
import { UserRepository } from '../repository';

// Service-level inputs (no HTTP DTOs).
export interface CreateUserInput {
  email: string;
  name?: string | null;
  password: string;
  permissions?: string[];
  accountId?: number;
}
export interface UpdateUserInput {
  name?: string | null;
  password?: string;
  permissions?: string[];
}

/**
 * Manage users within an account. Tenant admins (ADMIN) manage their own
 * account's users; super admins manage any account and may target an accountId.
 */
@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  list(actingUser: User, accountId?: number): Promise<User[]> {
    // Super admins may scope to any account (or all); everyone else is pinned
    // to their own account regardless of what they ask for.
    const scope = actingUser.isSuperAdmin ? accountId ?? null : actingUser.accountId;
    return this.users.findForAccount(scope);
  }

  async create(input: CreateUserInput, actingUser: User): Promise<User> {
    const accountId = this.resolveAccountId(input.accountId, actingUser);
    this.assertAssignable(input.permissions, actingUser);

    if (await this.users.findByEmailWithPermissions(input.email)) {
      throw new ConflictException(`A user with email "${input.email}" already exists`);
    }

    const created = await this.users.create({
      email: input.email,
      name: input.name ?? null,
      passwordHash: await bcrypt.hash(input.password, 10),
      account: { connect: { id: accountId } },
      permissions: { connect: (input.permissions ?? []).map((key) => ({ key })) },
    } as any);

    return (await this.users.findByIdWithPermissions(created.id))!;
  }

  async update(id: number, input: UpdateUserInput, actingUser: User): Promise<User> {
    const target = await this.getScoped(id, actingUser);
    this.assertCanManageTarget(target, actingUser);
    this.assertAssignable(input.permissions, actingUser);

    const data: Record<string, any> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.password) data.passwordHash = await bcrypt.hash(input.password, 10);
    if (input.permissions) data.permissions = { set: input.permissions.map((key) => ({ key })) };

    await this.users.update(id, data as any);
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

  private resolveAccountId(requested: number | undefined, actingUser: User): number {
    if (actingUser.isSuperAdmin) return requested ?? actingUser.accountId;
    return actingUser.accountId; // tenant admins can only create in their own account
  }

  private async getScoped(id: number, actingUser: User): Promise<User> {
    const user = await this.users.findByIdWithPermissions(id);
    if (!user || (!actingUser.isSuperAdmin && user.accountId !== actingUser.accountId)) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  /** Only super admins may grant SUPER_ADMIN. */
  private assertAssignable(permissions: string[] | undefined, actingUser: User): void {
    if (permissions?.includes(PermissionKey.SUPER_ADMIN) && !actingUser.isSuperAdmin) {
      throw new ForbiddenException('Only a super admin can grant SUPER_ADMIN');
    }
  }

  /**
   * A non-super admin sharing an account with a super admin must not be able to
   * edit or delete them (e.g. strip their SUPER_ADMIN role).
   */
  private assertCanManageTarget(target: User, actingUser: User): void {
    if (target.permissionKeys.includes(PermissionKey.SUPER_ADMIN) && !actingUser.isSuperAdmin) {
      throw new ForbiddenException('You cannot modify a super admin');
    }
  }
}
