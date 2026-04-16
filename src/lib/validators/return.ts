/**
 * Zod validation schemas for return operations.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6
 */

import { z } from 'zod/v4';

import { uuid } from '@/lib/validators/helpers';
import type { ReturnReason } from '@/types/database';

// ─── Return reasons enum ─────────────────────────────────────────────────────

const RETURN_REASONS: readonly ReturnReason[] = [
  'factory_defect',
  'wrong_size',
  'not_satisfied',
  'transport_damage',
  'other',
] as const;

// ─── Return line schema ──────────────────────────────────────────────────────

/** Schema for a single return line item. */
export const returnLineSchema = z.object({
  sale_line_id: uuid('ID de línea de venta inválido'),
  variant_id: uuid('ID de variante inválido'),
  quantity: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad debe ser mayor a 0'),
});

export type ReturnLineInput = z.infer<typeof returnLineSchema>;

// ─── Process return schema ───────────────────────────────────────────────────

/** Schema for processing a return. Requirements 9.1, 9.2, 9.3, 9.4 */
export const processReturnSchema = z.object({
  original_sale_id: uuid('ID de venta original inválido'),
  store_id: uuid('ID de tienda inválido'),
  reason: z.enum(RETURN_REASONS as unknown as readonly [string, ...string[]], {
    error: 'Motivo de devolución inválido',
  }),
  reason_note: z
    .string()
    .max(1000, 'La nota no puede exceder 1000 caracteres')
    .optional()
    .nullable(),
  lines: z
    .array(returnLineSchema)
    .min(1, 'Debe incluir al menos un artículo a devolver'),
});

export type ProcessReturnInput = z.infer<typeof processReturnSchema>;
