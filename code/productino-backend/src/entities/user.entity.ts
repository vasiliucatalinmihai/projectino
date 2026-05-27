import { PermissionKey } from '../common/permission-key';
import { Account } from './account.entity';
import { BaseEntity } from './base.entity';
import { Permission } from './permission.entity';

export class User extends BaseEntity {
  id: number;
  email: string;
  name: string | null;
  passwordHash: string;
  accountId: number;
  account?: Account;
  permissions?: Permission[];
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<User>) {
    super(partial);
  }

  /** Permission keys held by this user. */
  get permissionKeys(): string[] {
    return (this.permissions ?? []).map((p) => p.key);
  }

  /** Platform owner — bypasses tenant scoping and all permission gates. */
  get isSuperAdmin(): boolean {
    return this.permissionKeys.includes(PermissionKey.SUPER_ADMIN);
  }

  /** True if the user can satisfy the given permission. */
  hasPermission(key: PermissionKey | string): boolean {
    const keys = this.permissionKeys;
    if (keys.includes(PermissionKey.SUPER_ADMIN)) return true; // super admin → everything
    if (key === PermissionKey.SUPER_ADMIN) return false; // only super admins are super admins
    return keys.includes(PermissionKey.ADMIN) || keys.includes(key as string);
  }
}
