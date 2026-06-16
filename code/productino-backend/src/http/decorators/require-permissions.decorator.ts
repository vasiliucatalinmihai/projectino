import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../../common/permission-key';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Declares the access requirement for a route, read by PermissionsGuard:
 *   - absent             → public route
 *   - @RequirePermissions()                  → must be authenticated (any user)
 *   - @RequirePermissions(PermissionKey.X)   → must hold permission X (ADMIN bypasses)
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
