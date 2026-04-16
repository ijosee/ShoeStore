/**
 * Zustand store for POS cart state management.
 *
 * Manages cart lines, discounts, payments, and derived totals.
 * Uses calculateSaleTotals from tax utilities for accurate IVA calculations.
 *
 * Validates: Requirements 6.5, 6.6, 6.7, 6.8
 */

import { create } from 'zustand';

import { calculateSaleTotals } from '@/lib/utils/tax';
import type { CartDiscount, CartLine, CartPayment, CartState, CartTotals } from '@/types/cart';

// ─── Actions interface ───────────────────────────────────────────────────────

interface CartActions {
  /** Add a line to the cart. If the variant already exists, increment quantity (up to max_stock). */
  addLine: (line: CartLine) => void;
  /** Remove a line by its client-side id. */
  removeLine: (lineId: string) => void;
  /** Update quantity for a line (clamped between 1 and max_stock). */
  updateQuantity: (lineId: string, quantity: number) => void;
  /** Apply a cart-level discount (percentage or fixed_amount). */
  applyDiscount: (discount: CartDiscount) => void;
  /** Remove the cart-level discount. */
  removeDiscount: () => void;
  /** Set/replace the payments array. */
  setPayment: (payments: CartPayment[]) => void;
  /** Reset the cart to its initial empty state. */
  clearCart: () => void;
}

export type CartStore = CartState & CartActions;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_TOTALS: CartTotals = {
  raw_subtotal: 0,
  discount_amount: 0,
  subtotal: 0,
  tax_amount: 0,
  total: 0,
  change: 0,
};

function computeTotals(
  lines: CartLine[],
  discount: CartDiscount | null,
  payments: CartPayment[],
): CartTotals {
  if (lines.length === 0) {
    return EMPTY_TOTALS;
  }

  const saleLines = lines.map((l) => ({
    unitPrice: l.unit_price,
    quantity: l.quantity,
    taxRate: l.tax_rate,
    lineDiscount: l.line_discount,
  }));

  const saleDiscount = discount
    ? { type: discount.type, value: discount.value }
    : undefined;

  const result = calculateSaleTotals(saleLines, saleDiscount);

  // raw_subtotal = sum of (unit_price * quantity) before any discounts
  const raw_subtotal = lines.reduce(
    (sum, l) => sum + l.unit_price * l.quantity,
    0,
  );

  // Calculate change: for cash payments, change = amount_received - amount
  // Only payments with amount_received (cash) contribute to change.
  const change = payments.reduce((sum, p) => {
    if (p.amount_received !== null) {
      return sum + Math.max(0, p.amount_received - p.amount);
    }
    return sum;
  }, 0);

  return {
    raw_subtotal,
    discount_amount: result.discount_amount,
    subtotal: result.subtotal,
    tax_amount: result.tax_amount,
    total: result.total,
    change,
  };
}

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: CartState = {
  lines: [],
  discount: null,
  payments: [],
  totals: EMPTY_TOTALS,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>((set) => ({
  ...initialState,

  addLine: (line) => {
    set((state) => {
      const existingIndex = state.lines.findIndex(
        (l) => l.variant_id === line.variant_id,
      );

      let newLines: CartLine[];

      if (existingIndex >= 0) {
        // Variant already in cart — increment quantity up to max_stock
        newLines = state.lines.map((l, i) => {
          if (i !== existingIndex) return l;
          const newQty = Math.min(l.quantity + line.quantity, l.max_stock);
          return { ...l, quantity: newQty };
        });
      } else {
        // New variant — clamp quantity to max_stock
        const clampedLine = {
          ...line,
          quantity: Math.min(line.quantity, line.max_stock),
        };
        newLines = [...state.lines, clampedLine];
      }

      return {
        lines: newLines,
        totals: computeTotals(newLines, state.discount, state.payments),
      };
    });
  },

  removeLine: (lineId) => {
    set((state) => {
      const newLines = state.lines.filter((l) => l.id !== lineId);
      return {
        lines: newLines,
        totals: computeTotals(newLines, state.discount, state.payments),
      };
    });
  },

  updateQuantity: (lineId, quantity) => {
    set((state) => {
      const newLines = state.lines.map((l) => {
        if (l.id !== lineId) return l;
        const clampedQty = Math.max(1, Math.min(quantity, l.max_stock));
        return { ...l, quantity: clampedQty };
      });
      return {
        lines: newLines,
        totals: computeTotals(newLines, state.discount, state.payments),
      };
    });
  },

  applyDiscount: (discount) => {
    set((state) => ({
      discount,
      totals: computeTotals(state.lines, discount, state.payments),
    }));
  },

  removeDiscount: () => {
    set((state) => ({
      discount: null,
      totals: computeTotals(state.lines, null, state.payments),
    }));
  },

  setPayment: (payments) => {
    set((state) => ({
      payments,
      totals: computeTotals(state.lines, state.discount, payments),
    }));
  },

  clearCart: () => {
    set({ ...initialState });
  },
}));
