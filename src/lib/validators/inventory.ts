/**
 * Zod validation schemas for inventory operations.
 *
 * Validates: Requirements 3.1, 3.4, 3.8, 4.1, 4.2, 13.3
 */

import { z } from 'zod/v4';

import { uuid } from '@/lib/validators/helpers';
import type { AdjustmentReason } from '@/types/database';

// ─── Adjustment reasons enum ─────────────────────────────────────────────────

const ADJUSTMENT_REASONS: readonly AdjustmentReason[] = [
  'physical_count',
  'damage',
  'theft_loss',
  'system_error',
  'other',
] as const;

// ─── Stock adjustment schema ─────────────────────────────────────────────────

/** Schema for a stock adjustment. Requirement 3.8 */
export const stockAdjustmentSchema = z.object({
  variant_id: uuid('ID de variante inválido'),
  store_id: uuid('ID de tienda inválido'),
  new_quantity: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(0, 'La cantidad no puede ser negativa'),
  reason: z.enum(ADJUSTMENT_REASONS as unknown as readonly [string, ...string[]], {
    error: 'Motivo de ajuste inválido',
  }),
  note: z
    .string()
    .min(1, 'La nota es requerida')
    .max(1000, 'La nota no puede exceder 1000 caracteres'),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

// ─── Transfer line schema ────────────────────────────────────────────────────

/** Schema for a single transfer line. */
export const transferLineSchema = z.object({
  variant_id: uuid('ID de variante inválido'),
  quantity: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad debe ser mayor a 0'),
});

export type TransferLineInput = z.infer<typeof transferLineSchema>;

// ─── Transfer schema ─────────────────────────────────────────────────────────

/** Schema for a stock transfer between stores. Requirements 4.1, 4.2 */
export const transferSchema = z
  .object({
    source_store_id: uuid('ID de tienda origen inválido'),
    destination_store_id: uuid('ID de tienda destino inválido'),
    lines: z
      .array(transferLineSchema)
      .min(1, 'Debe incluir al menos una línea de transferencia'),
    note: z
      .string()
      .max(1000, 'La nota no puede exceder 1000 caracteres')
      .optional(),
  })
  .refine(
    (data) => data.source_store_id !== data.destination_store_id,
    {
      message: 'La tienda origen y destino deben ser diferentes',
      path: ['destination_store_id'],
    },
  );

export type TransferInput = z.infer<typeof transferSchema>;

// ─── Alert acknowledge schema ────────────────────────────────────────────────

/** Schema for acknowledging a stock alert. Requirement 13.3 */
export const alertAcknowledgeSchema = z.object({
  note: z
    .string()
    .max(1000, 'La nota no puede exceder 1000 caracteres')
    .optional(),
});

export type AlertAcknowledgeInput = z.infer<typeof alertAcknowledgeSchema>;
