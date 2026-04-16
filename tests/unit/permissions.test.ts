/**
 * Unit tests for the RBAC permission system.
 *
 * Validates: Requirements 2.2, 2.3, 11.6
 */

import { describe, it, expect } from 'vitest';

import { hasPermission, getUserPermissions } from '@/lib/auth/permissions';
import { ROLE_PERMISSIONS } from '@/lib/constants';
import type { Permission } from '@/types/permissions';
import type { UserRole } from '@/types/database';

describe('hasPermission', () => {
  it('returns true for permissions the role has', () => {
    expect(hasPermission('admin', 'user.manage')).toBe(true);
    expect(hasPermission('admin', 'config.manage')).toBe(true);
    expect(hasPermission('manager', 'stock.adjust')).toBe(true);
    expect(hasPermission('seller', 'sale.create')).toBe(true);
  });

  it('returns false for permissions the role does not have', () => {
    expect(hasPermission('seller', 'user.manage')).toBe(false);
    expect(hasPermission('seller', 'config.manage')).toBe(false);
    expect(hasPermission('seller', 'stock.adjust')).toBe(false);
    expect(hasPermission('manager', 'user.manage')).toBe(false);
    expect(hasPermission('manager', 'config.manage')).toBe(false);
  });

  it('returns false for an unknown role', () => {
    expect(hasPermission('unknown' as UserRole, 'sale.create')).toBe(false);
  });
});

describe('getUserPermissions', () => {
  it('returns all permissions for admin', () => {
    const perms = getUserPermissions('admin');
    expect(perms).toEqual(ROLE_PERMISSIONS.admin);
  });

  it('returns all permissions for manager', () => {
    const perms = getUserPermissions('manager');
    expect(perms).toEqual(ROLE_PERMISSIONS.manager);
  });

  it('returns all permissions for seller', () => {
    const perms = getUserPermissions('seller');
    expect(perms).toEqual(ROLE_PERMISSIONS.seller);
  });

  it('returns empty array for unknown role', () => {
    const perms = getUserPermissions('unknown' as UserRole);
    expect(perms).toEqual([]);
  });
});

describe('ROLE_PERMISSIONS matrix matches requirements §2.3', () => {
  // Admin should have all permissions
  const allPermissions: Permission[] = [
    'product.create',
    'product.edit',
    'product.view',
    'stock.view_all',
    'stock.view_own_store',
    'stock.adjust',
    'transfer.create',
    'sale.create',
    'sale.cancel',
    'sale.void',
    'return.process',
    'user.manage',
    'report.view_global',
    'report.view_store',
    'config.manage',
    'audit.view',
    'cash.close',
  ];

  it('admin has all permissions', () => {
    for (const perm of allPermissions) {
      expect(hasPermission('admin', perm)).toBe(true);
    }
    expect(getUserPermissions('admin')).toHaveLength(allPermissions.length);
  });

  it('manager cannot create/edit products, manage users, view global reports, or manage config', () => {
    expect(hasPermission('manager', 'product.create')).toBe(false);
    expect(hasPermission('manager', 'product.edit')).toBe(false);
    expect(hasPermission('manager', 'stock.view_all')).toBe(false);
    expect(hasPermission('manager', 'user.manage')).toBe(false);
    expect(hasPermission('manager', 'report.view_global')).toBe(false);
    expect(hasPermission('manager', 'config.manage')).toBe(false);
  });

  it('manager can adjust stock, void sales, view audit, and close cash', () => {
    expect(hasPermission('manager', 'stock.adjust')).toBe(true);
    expect(hasPermission('manager', 'sale.void')).toBe(true);
    expect(hasPermission('manager', 'audit.view')).toBe(true);
    expect(hasPermission('manager', 'cash.close')).toBe(true);
  });

  it('seller has only basic permissions', () => {
    const sellerPerms = getUserPermissions('seller');
    expect(sellerPerms).toContain('product.view');
    expect(sellerPerms).toContain('stock.view_own_store');
    expect(sellerPerms).toContain('sale.create');
    expect(sellerPerms).toContain('sale.cancel');
    expect(sellerPerms).toContain('return.process');
    expect(sellerPerms).toHaveLength(5);
  });

  it('seller cannot void sales, adjust stock, or view audit', () => {
    expect(hasPermission('seller', 'sale.void')).toBe(false);
    expect(hasPermission('seller', 'stock.adjust')).toBe(false);
    expect(hasPermission('seller', 'audit.view')).toBe(false);
    expect(hasPermission('seller', 'user.manage')).toBe(false);
  });
});
