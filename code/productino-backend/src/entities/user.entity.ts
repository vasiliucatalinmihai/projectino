import { PermissionKey } from '../common/permission-key';
import { BaseEntity } from './base.entity';
import { Permission } from './permission.entity';

export class User extends BaseEntity {
  id: number;
  email: string;
  name: string | null;
  passwordHash: string;
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

  /** True if the user is an admin or holds the given permission. */
  hasPermission(key: PermissionKey | string): boolean {
    const keys = this.permissionKeys;
    return keys.includes(PermissionKey.ADMIN) || keys.includes(key as string);
  }
}
