/**
 * Hook to verify permissions in components.
 *
 * Uses the auth store to get the current user's role and provides
 * a convenience function to check specific permissions.
 *
 * Validates: Requirements 2.2, 2.3, 11.6
 */

'use client';

import { useCallback } from 'react';

import { useAuthStore } from '@/stores/auth-store';
import {
  hasPermission as checkPermission,
  getUserPermissions,
} from '@/lib/auth/permissions';
import type { Permission } from '@/types/permissions';

export function usePermissions() {
  const role = useAuthStore((state) => state.user?.role ?? null);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!role) return false;
      return checkPermission(role, permission);
    },
    [role],
  );

  const permissions: Permission[] = role ? getUserPermissions(role) : [];

  return {
    /** Check if the current user has a specific permission. */
    hasPermission,
    /** All permissions for the current user's role. */
    permissions,
    /** The current user's role, or null if not authenticated. */
    role,
  };
}
