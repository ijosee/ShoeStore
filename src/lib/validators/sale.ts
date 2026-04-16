/**
 * Zod validation schemas for sales and payments.
 *
 * Validates: Requirements 6.5, 6.7, 6.8, 6.9, 7.2, 7.3
 */

import { z } from 'zod/v4';

import { uuid } from '@/lib/validators/helpers';

// ─── Sale line schema ────────────────────────────────────────────────────────

/** Schema for a single sale line item. */
export const saleLineSchema = z.object({
  variant_id: uuid('ID de variante inválido'),
  quantity: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad debe ser mayor a 0'),
  unit_price: z
    .number()
    .min(0, 'El precio unitario debe ser mayor o igual a 0'),
  line_discount: z
    .number()
    .min(0, 'El descuento de línea debe ser mayor o igual a 0')
    .optional()
    .default(0),
});

export type SaleLineInput = z.infer<typeof saleLineSchema>;

// ─── Payment schema ──────────────────────────────────────────────────────────

/** Schema for a single payment entry. */
export const paymentSchema = z.object({
  payment_method_id: uuid('ID de método de pago inválido'),
  amount: z
    .number()
    .min(0, 'El monto del pago debe ser mayor o igual a 0'),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// ─── Discount schema ─────────────────────────────────────────────────────────

/** Schema for an optional sale-level discount. */
export const discountSchema = z.object({
  type: z.enum(['percentage', 'fixed_amount']),
  value: z
    .number()
    .min(0, 'El valor del descuento debe ser mayor o igual a 0'),
});

export type DiscountInput = z.infer<typeof discountSchema>;

// ─── Confirm sale schema ─────────────────────────────────────────────────────

/** Schema for confirming a sale. Requirements 6.9, 7.2, 7.3 */
export const confirmSaleSchema = z.object({
  store_id: uuid('ID de tienda inválido'),
  lines: z
    .array(saleLineSchema)
    .min(1, 'El carrito no puede estar vacío'),
  discount: discountSchema.optional(),
  payments: z
    .array(paymentSchema)
    .min(1, 'Debe incluir al menos un pago'),
});

export type ConfirmSaleInput = z.infer<typeof confirmSaleSchema>;

// ─── Void sale schema ────────────────────────────────────────────────────────

/** Schema for voiding a completed sale. */
export const voidSaleSchema = z.object({
  sale_id: uuid('ID de venta inválido'),
  reason: z
    .string()
    .min(1, 'El motivo de anulación es requerido')
    .max(500, 'El motivo no puede exceder 500 caracteres'),
});

export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
