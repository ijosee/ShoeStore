/**
 * Types for the RBAC permission system.
 *
 * Mirrors the permission matrix from requirements §2.3 and
 * the ROLE_PERMISSIONS map from design §9.2.
 */

import type { UserRole } from './database';

/** All granular permissions in the system. */
export type Permission =
  | 'product.create'
  | 'product.edit'
  | 'product.view'
  | 'stock.view_all'
  | 'stock.view_own_store'
  | 'stock.adjust'
  | 'transfer.create'
  | 'sale.create'
  | 'sale.cancel'
  | 'sale.void'
  | 'return.process'
  | 'user.manage'
  | 'report.view_global'
  | 'report.view_store'
  | 'config.manage'
  | 'audit.view'
  | 'cash.close';

/** Map of roles to their granted permissions. */
export type RolePermissionMap = Record<UserRole, Permission[]>;

/** Authenticated user profile used throughout the app. */
export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  /** Store IDs the user is assigned to. */
  store_ids: string[];
}

/** Session state managed by the auth Zustand store. */
export interface AuthState {
  user: AuthUser | null;
  /** The currently selected store for multi-store users. */
  active_store_id: string | null;
  is_loading: boolean;
}
