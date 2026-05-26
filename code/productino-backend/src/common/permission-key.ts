/**
 * Canonical permission keys. These must match the `key` column of the rows in
 * the `permissions` table (see prisma/seed.ts). Use them in route decorators:
 *
 *   @RequirePermissions(PermissionKey.RUN_LLM)
 */
export enum PermissionKey {
  ADMIN = 'ADMIN', // full access — bypasses every other permission check
  VIEW_ONLY = 'VIEW_ONLY', // read-only access
  RUN_LLM = 'RUN_LLM', // may invoke AI/LLM features
  UPDATE_SETTINGS = 'UPDATE_SETTINGS', // may change application settings
  MANAGE_PROMPTS = 'MANAGE_PROMPTS', // may edit/promote prompt versions
}

export const ALL_PERMISSIONS: { key: PermissionKey; description: string }[] = [
  { key: PermissionKey.ADMIN, description: 'Full access to everything' },
  { key: PermissionKey.VIEW_ONLY, description: 'Read-only access' },
  { key: PermissionKey.RUN_LLM, description: 'Can run AI/LLM features' },
  { key: PermissionKey.UPDATE_SETTINGS, description: 'Can change application settings' },
  { key: PermissionKey.MANAGE_PROMPTS, description: 'Can edit and promote prompt versions' },
];
