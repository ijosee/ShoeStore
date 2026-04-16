/**
 * Cart types for the POS module.
 */

import type { DiscountType } from './database';

/** A single line item in the POS cart. */
export interface CartLine {
  /** Temporary client-side id for the line. */
  id: string;
  variant_id: string;
  product_name: string;
  variant_description: string;
  sku: string;
  image_url: string | null;
  size: string;
  color: string;
  quantity: number;
  max_stock: number;
  unit_price: number;
  tax_rate: number;
  /** Discount applied to this specific line (absolute amount). */
  line_discount: number;
}

/** Discount applied at the cart level. */
export interface CartDiscount {
  type: DiscountType;
  /** Percentage (0-100) or fixed amount in MXN. */
  value: number;
}

/** Payment entry in the cart. */
export interface CartPayment {
  payment_method_id: string;
  payment_method_name: string;
  amount: number;
  /** Only for cash payments: amount the customer handed over. */
  amount_received: number | null;
}

/** Computed totals for the cart (derived, not stored). */
export interface CartTotals {
  raw_subtotal: number;
  discount_amount: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  change: number;
}

/** Full state of the POS cart managed by Zustand. */
export interface CartState {
  lines: CartLine[];
  discount: CartDiscount | null;
  payments: CartPayment[];
  totals: CartTotals;
}
