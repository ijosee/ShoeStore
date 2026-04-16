/**
 * RBAC permission utilities.
 *
 * Provides functions to check and retrieve permissions based on user roles.
 * Uses the ROLE_PERMISSIONS map defined in constants.ts.
 *
 * Validates: Requirements 11.6, 2.2, 2.3
 */

import type { UserRole } from '@/types/database';
import type { Permission } from '@/types/permissions';
import { ROLE_PERMISSIONS } from '@/lib/constants';

/**
 * Check whether a given role has a specific permission.
 *
 * @param role - The user's role (admin, manager, seller)
 * @param permission - The permission to check
 * @returns true if the role includes the permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}

/**
 * Get all permissions granted to a role.
 *
 * @param role - The user's role
 * @returns Array of permissions for the role, or empty array if role is unknown
 */
export function getUserPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
