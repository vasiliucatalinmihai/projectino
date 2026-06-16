import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionKey } from '../../common/permission-key';
import { User } from '../../entities';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

/**
 * Authorization guard, registered globally. Reads the `@RequirePermissions(...)`
 * metadata on the handler/controller:
 *   - no metadata        → public, allow
 *   - metadata present   → require an authenticated user (set by AuthMiddleware)
 *   - non-empty list     → user must hold *all* listed permissions (ADMIN bypasses)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No decorator on the route → public.
    if (required === undefined) return true;

    const user = context.switchToHttp().getRequest().user as User | undefined;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (required.length === 0) return true; // authenticated-only route

    const keys = user.permissionKeys ?? [];
    // Super admin passes everything.
    if (keys.includes(PermissionKey.SUPER_ADMIN)) return true;
    // A tenant admin bypasses every gate except SUPER_ADMIN-only routes.
    const requiresSuper = required.includes(PermissionKey.SUPER_ADMIN);
    if (!requiresSuper && keys.includes(PermissionKey.ADMIN)) return true;

    const hasAll = required.every((perm) => keys.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException(`Missing required permission(s): ${required.join(', ')}`);
    }
    return true;
  }
}
