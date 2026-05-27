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
import { CreateUserRequest, UpdateUserRequest } from '../http/request/user';
import { UserResponse } from '../http/response/auth';

/**
 * Manage users within an account. Tenant admins (ADMIN) manage their own
 * account's users; super admins manage any account and may target an accountId.
 */
@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  async list(actingUser: User, accountId?: number): Promise<UserResponse[]> {
    // Super admins may scope to any account (or all); everyone else is pinned
    // to their own account regardless of what they ask for.
    const scope = actingUser.isSuperAdmin ? accountId ?? null : actingUser.accountId;
    const users = await this.users.findForAccount(scope);
    return users.map(UserResponse.fromEntity);
  }

  async create(body: CreateUserRequest, actingUser: User): Promise<UserResponse> {
    const accountId = this.resolveAccountId(body.accountId, actingUser);
    this.assertAssignable(body.permissions, actingUser);

    if (await this.users.findByEmailWithPermissions(body.email)) {
      throw new ConflictException(`A user with email "${body.email}" already exists`);
    }

    const created = await this.users.create({
      email: body.email,
      name: body.name ?? null,
      passwordHash: await bcrypt.hash(body.password, 10),
      account: { connect: { id: accountId } },
      permissions: { connect: (body.permissions ?? []).map((key) => ({ key })) },
    } as any);

    return UserResponse.fromEntity(await this.users.findByIdWithPermissions(created.id));
  }

  async update(id: number, body: UpdateUserRequest, actingUser: User): Promise<UserResponse> {
    const target = await this.getScoped(id, actingUser);
    this.assertCanManageTarget(target, actingUser);
    this.assertAssignable(body.permissions, actingUser);

    const data: Record<string, any> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);
    if (body.permissions) data.permissions = { set: body.permissions.map((key) => ({ key })) };

    await this.users.update(id, data as any);
    return UserResponse.fromEntity(await this.users.findByIdWithPermissions(id));
  }

  async remove(id: number, actingUser: User): Promise<UserResponse> {
    const target = await this.getScoped(id, actingUser);
    this.assertCanManageTarget(target, actingUser);
    if (target.id === actingUser.id) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    await this.users.delete(id);
    return UserResponse.fromEntity(target);
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
