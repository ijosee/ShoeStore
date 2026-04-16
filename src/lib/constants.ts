/**
 * Application-wide constants for ShoeStore POS & Inventory.
 */

import type { RolePermissionMap } from '@/types/permissions';

// ─── Roles ───────────────────────────────────────────────────────────────────

export const USER_ROLES = ['admin', 'manager', 'seller'] as const;

export const ROLE_LABELS: Record<(typeof USER_ROLES)[number], string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  seller: 'Vendedor',
};

// ─── Permissions ─────────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: RolePermissionMap = {
  admin: [
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
  ],
  manager: [
    'product.view',
    'stock.view_own_store',
    'stock.adjust',
    'transfer.create',
    'sale.create',
    'sale.cancel',
    'sale.void',
    'return.process',
    'report.view_store',
    'audit.view',
    'cash.close',
  ],
  seller: [
    'product.view',
    'stock.view_own_store',
    'sale.create',
    'sale.cancel',
    'return.process',
  ],
};

// ─── Stock movement types ────────────────────────────────────────────────────

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  entry: 'Entrada',
  sale: 'Venta',
  return: 'Devolución',
  adjustment: 'Ajuste',
  transfer_out: 'Salida por transferencia',
  transfer_in: 'Entrada por transferencia',
};

// ─── Sale statuses ───────────────────────────────────────────────────────────

export const SALE_STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  voided: 'Anulada',
};

// ─── Transfer statuses ───────────────────────────────────────────────────────

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

// ─── Return reasons ──────────────────────────────────────────────────────────

export const RETURN_REASON_LABELS: Record<string, string> = {
  factory_defect: 'Defecto de fábrica',
  wrong_size: 'Talla incorrecta',
  not_satisfied: 'No satisface expectativas',
  transport_damage: 'Daño en transporte',
  other: 'Otro',
};

// ─── Adjustment reasons ──────────────────────────────────────────────────────

export const ADJUSTMENT_REASON_LABELS: Record<string, string> = {
  physical_count: 'Conteo físico',
  damage: 'Daño',
  theft_loss: 'Robo/Pérdida',
  system_error: 'Error de sistema',
  other: 'Otro',
};

// ─── Stock alert statuses ────────────────────────────────────────────────────

export const ALERT_STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  acknowledged: 'Atendida',
};

// ─── Tax ─────────────────────────────────────────────────────────────────────

/** Default IVA rate in Spain (21%). */
export const DEFAULT_TAX_RATE = 0.21;

// ─── Pagination ──────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_EXPORT_ROWS = 50_000;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;
export const JWT_EXPIRY_HOURS = 8;
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// ─── Password policy ─────────────────────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 8;

// ─── Product constraints ─────────────────────────────────────────────────────

export const PRODUCT_NAME_MAX_LENGTH = 200;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 5_000;
export const MAX_PRODUCT_IMAGES = 10;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ─── Return policy ───────────────────────────────────────────────────────────

/** Default number of days within which returns are accepted without approval. */
export const RETURN_WINDOW_DAYS = 30;

// ─── POS ─────────────────────────────────────────────────────────────────────

/** Debounce delay for the POS search bar (ms). */
export const SEARCH_DEBOUNCE_MS = 300;

// ─── Printing ────────────────────────────────────────────────────────────────

export const PAPER_WIDTH_CHARS = {
  '58mm': 32,
  '80mm': 48,
} as const;

// ─── Routes (for middleware & navigation) ────────────────────────────────────

export const ADMIN_ONLY_PATHS = ['/usuarios', '/config'];
export const MANAGER_ADMIN_PATHS = ['/inventario/ajustes', '/auditoria'];
