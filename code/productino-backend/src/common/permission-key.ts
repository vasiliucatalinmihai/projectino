/**
 * Canonical permission keys. These must match the `key` column of the rows in
 * the `permissions` table (see prisma/seed.ts). Use them in route decorators:
 *
 *   @RequirePermissions(PermissionKey.RUN_LLM)
 */
export enum PermissionKey {
  SUPER_ADMIN = 'SUPER_ADMIN', // platform owner — crosses all accounts/tenants
  ADMIN = 'ADMIN', // full access within the user's own account
  VIEW_ONLY = 'VIEW_ONLY', // read-only access
  RUN_LLM = 'RUN_LLM', // may invoke AI/LLM features
  UPDATE_SETTINGS = 'UPDATE_SETTINGS', // may change application settings
  MANAGE_PROMPTS = 'MANAGE_PROMPTS', // may edit/promote prompt versions
  RESET_PROJECT = 'RESET_PROJECT', // may reset a project's analysis (cascading, destructive)
}

export const ALL_PERMISSIONS: { key: PermissionKey; description: string }[] = [
  { key: PermissionKey.SUPER_ADMIN, description: 'Platform owner — access across all accounts' },
  { key: PermissionKey.ADMIN, description: 'Full access within own account' },
  { key: PermissionKey.VIEW_ONLY, description: 'Read-only access' },
  { key: PermissionKey.RUN_LLM, description: 'Can run AI/LLM features' },
  { key: PermissionKey.UPDATE_SETTINGS, description: 'Can change application settings' },
  { key: PermissionKey.MANAGE_PROMPTS, description: 'Can edit and promote prompt versions' },
  { key: PermissionKey.RESET_PROJECT, description: "Can reset a project's analysis (cascading)" },
];
