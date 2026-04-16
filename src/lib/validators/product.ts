/**
 * Zod validation schemas for product and variant management.
 *
 * Validates: Requirements 1.1, 1.2, 1.5, 1.6, 1.7
 */

import { z } from 'zod/v4';

import { uuid } from '@/lib/validators/helpers';
import {
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
} from '@/lib/constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * EAN-13 barcode validation.
 * Validates that the string is exactly 13 digits and the check digit is correct.
 */
function isValidEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;

  const digits = barcode.split('').map(Number);
  const checkDigit = digits[12];
  const sum = digits
    .slice(0, 12)
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const expected = (10 - (sum % 10)) % 10;

  return checkDigit === expected;
}

// ─── Variant schema ──────────────────────────────────────────────────────────

/** Schema for a single product variant. */
export const variantSchema = z.object({
  size_id: uuid('ID de talla inválido'),
  color_id: uuid('ID de color inválido'),
  barcode: z
    .string()
    .refine(isValidEAN13, 'Código de barras EAN-13 inválido')
    .optional(),
  price_override: z
    .number()
    .min(0, 'El precio de variante debe ser mayor o igual a 0')
    .optional(),
});

export type VariantInput = z.infer<typeof variantSchema>;

// ─── Create product schema ───────────────────────────────────────────────────

/** Schema for creating a new product. Requirements 1.1, 1.2 */
export const createProductSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre del producto es requerido')
    .max(PRODUCT_NAME_MAX_LENGTH, `El nombre no puede exceder ${PRODUCT_NAME_MAX_LENGTH} caracteres`),
  brand_id: uuid('ID de marca inválido'),
  category_id: uuid('ID de categoría inválido'),
  description: z
    .string()
    .max(
      PRODUCT_DESCRIPTION_MAX_LENGTH,
      `La descripción no puede exceder ${PRODUCT_DESCRIPTION_MAX_LENGTH} caracteres`,
    )
    .optional(),
  base_price: z
    .number()
    .min(0, 'El precio base debe ser mayor o igual a 0'),
  cost: z
    .number()
    .min(0, 'El costo debe ser mayor o igual a 0'),
  tax_rate: z
    .number()
    .min(0, 'La tasa de impuesto debe ser mayor o igual a 0')
    .max(1, 'La tasa de impuesto debe ser menor o igual a 1'),
  variants: z
    .array(variantSchema)
    .min(1, 'Debe incluir al menos una variante'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ─── Update product schema ───────────────────────────────────────────────────

/** Schema for updating an existing product (all fields optional). */
export const updateProductSchema = createProductSchema.partial();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
