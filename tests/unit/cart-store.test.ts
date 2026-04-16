/**
 * Unit tests for the cart Zustand store.
 *
 * Covers: addLine, removeLine, updateQuantity, applyDiscount,
 * removeDiscount, setPayment, clearCart, computed totals, and change calculation.
 *
 * Validates: Requirements 6.5, 6.6, 6.7, 6.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '@/stores/cart-store';
import { calculateSaleTotals } from '@/lib/utils/tax';
import type { CartLine } from '@/types/cart';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: 'line-1',
    variant_id: 'variant-1',
    product_name: 'Zapato Oxford Classic',
    variant_description: 'T27-Negro',
    sku: 'FOR-MRX-27-NEG',
    image_url: null,
    size: '27',
    color: 'Negro',
    quantity: 1,
    max_stock: 10,
    unit_price: 1200,
    tax_rate: 0.16,
    line_discount: 0,
    ...overrides,
  };
}

function resetStore() {
  useCartStore.getState().clearCart();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('cart-store', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── addLine ──────────────────────────────────────────────────────────────

  describe('addLine', () => {
    it('adds a new line to an empty cart', () => {
      const line = makeLine();
      useCartStore.getState().addLine(line);

      const state = useCartStore.getState();
      expect(state.lines).toHaveLength(1);
      expect(state.lines[0].variant_id).toBe('variant-1');
      expect(state.lines[0].quantity).toBe(1);
    });

    it('increments quantity when adding a duplicate variant', () => {
      const line = makeLine({ quantity: 2 });
      useCartStore.getState().addLine(line);
      // Add same variant again with quantity 3
      useCartStore.getState().addLine(makeLine({ id: 'line-dup', quantity: 3 }));

      const state = useCartStore.getState();
      expect(state.lines).toHaveLength(1);
      expect(state.lines[0].quantity).toBe(5); // 2 + 3
    });

    it('caps quantity at max_stock when adding duplicate variant', () => {
      const line = makeLine({ quantity: 8, max_stock: 10 });
      useCartStore.getState().addLine(line);
      useCartStore.getState().addLine(makeLine({ id: 'line-dup', quantity: 5 }));

      const state = useCartStore.getState();
      expect(state.lines).toHaveLength(1);
      expect(state.lines[0].quantity).toBe(10); // capped at max_stock
    });

    it('clamps initial quantity to max_stock for new lines', () => {
      const line = makeLine({ quantity: 15, max_stock: 10 });
      useCartStore.getState().addLine(line);

      const state = useCartStore.getState();
      expect(state.lines[0].quantity).toBe(10);
    });

    it('adds multiple different variants', () => {
      useCartStore.getState().addLine(makeLine({ id: 'l1', variant_id: 'v1' }));
      useCartStore.getState().addLine(makeLine({ id: 'l2', variant_id: 'v2', product_name: 'Tenis Sport' }));

      const state = useCartStore.getState();
      expect(state.lines).toHaveLength(2);
    });

    it('recalculates totals after adding a line', () => {
      useCartStore.getState().addLine(makeLine({ unit_price: 1200, quantity: 1, tax_rate: 0.16 }));

      const { totals } = useCartStore.getState();
      expect(totals.raw_subtotal).toBe(1200);
      expect(totals.total).toBeGreaterThan(0);
    });
  });

  // ── removeLine ───────────────────────────────────────────────────────────

  describe('removeLine', () => {
    it('removes a line by id', () => {
      useCartStore.getState().addLine(makeLine({ id: 'l1', variant_id: 'v1' }));
      useCartStore.getState().addLine(makeLine({ id: 'l2', variant_id: 'v2' }));
      useCartStore.getState().removeLine('l1');

      const state = useCartStore.getState();
      expect(state.lines).toHaveLength(1);
      expect(state.lines[0].id).toBe('l2');
    });

    it('does nothing when removing a non-existent id', () => {
      useCartStore.getState().addLine(makeLine());
      useCartStore.getState().removeLine('non-existent');

      expect(useCartStore.getState().lines).toHaveLength(1);
    });

    it('resets totals to zero when last line is removed', () => {
      useCartStore.getState().addLine(makeLine());
      useCartStore.getState().removeLine('line-1');

      const { totals } = useCartStore.getState();
      expect(totals.total).toBe(0);
      expect(totals.subtotal).toBe(0);
      expect(totals.tax_amount).toBe(0);
    });
  });

  // ── updateQuantity ───────────────────────────────────────────────────────

  describe('updateQuantity', () => {
    it('updates quantity within bounds', () => {
      useCartStore.getState().addLine(makeLine({ max_stock: 10 }));
      useCartStore.getState().updateQuantity('line-1', 5);

      expect(useCartStore.getState().lines[0].quantity).toBe(5);
    });

    it('clamps quantity to 1 when set below 1', () => {
      useCartStore.getState().addLine(makeLine());
      useCartStore.getState().updateQuantity('line-1', 0);

      expect(useCartStore.getState().lines[0].quantity).toBe(1);
    });

    it('clamps quantity to max_stock when set above', () => {
      useCartStore.getState().addLine(makeLine({ max_stock: 5 }));
      useCartStore.getState().updateQuantity('line-1', 20);

      expect(useCartStore.getState().lines[0].quantity).toBe(5);
    });

    it('recalculates totals after quantity change', () => {
      useCartStore.getState().addLine(makeLine({ unit_price: 1000, tax_rate: 0.16 }));
      useCartStore.getState().updateQuantity('line-1', 3);

      const { totals } = useCartStore.getState();
      expect(totals.raw_subtotal).toBe(3000);
    });
  });

  // ── applyDiscount ────────────────────────────────────────────────────────

  describe('applyDiscount', () => {
    it('applies a percentage discount', () => {
      useCartStore.getState().addLine(makeLine({ unit_price: 1000, quantity: 1, tax_rate: 0.16 }));
      useCartStore.getState().applyDiscount({ type: 'percentage', value: 10 });

      const state = useCartStore.getState();
      expect(state.discount).toEqual({ type: 'percentage', value: 10 });
      expect(state.totals.discount_amount).toBe(100);
    });

    it('applies a fixed_amount discount', () => {
      useCartStore.getState().addLine(makeLine({ unit_price: 1000, quantity: 1, tax_rate: 0.16 }));
      useCartStore.getState().applyDiscount({ type: 'fixed_amount', value: 200 });

      const state = useCartStore.getState();
      expect(state.discount).toEqual({ type: 'fixed_amount', value: 200 });
      expect(state.totals.discount_amount).toBe(200);
    });

    it('replaces an existing discount', () => {
      useCartStore.getState().addLine(makeLine({ unit_price: 1000, quantity: 1, tax_rate: 0.16 }));
      useCartStore.getState().applyDiscount({ type: 'percentage', value: 10 });
      useCartStore.getState().applyDiscount({ type: 'fixed_amount', value: 50 });

      const state = useCartStore.getState();
      expect(state.discount?.type).toBe('fixed_amount');
      expect(state.totals.discount_amount).toBe(50);
    });
  });

  // ── removeDiscount ───────────────────────────────────────────────────────

  describe('removeDiscount', () => {
    it('clears the discount and recalculates totals', () => {
      useCartStore.getState().addLine(makeLine({ unit_price: 1000, quantity: 1, tax_rate: 0.16 }));
      useCartStore.getState().applyDiscount({ type: 'percentage', value: 10 });
      useCartStore.getState().removeDiscount();

      const state = useCartStore.getState();
      expect(state.discount).toBeNull();
      expect(state.totals.discount_amount).toBe(0);
      expect(state.totals.subtotal).toBe(1000);
    });
  });

  // ── setPayment ───────────────────────────────────────────────────────────

  describe('setPayment', () => {
    it('sets the payments array', () => {
      useCartStore.getState().setPayment([
        {
          payment_method_id: 'pm-card',
          payment_method_name: 'Tarjeta',
          amount: 1160,
          amount_received: null,
        },
      ]);

      const state = useCartStore.getState();
      expect(state.payments).toHaveLength(1);
      expect(state.payments[0].payment_method_name).toBe('Tarjeta');
    });

    it('replaces existing payments', () => {
      useCartStore.getState().setPayment([
        { payment_method_id: 'pm-1', payment_method_name: 'Efectivo', amount: 500, amount_received: 600 },
      ]);
      useCartStore.getState().setPayment([
        { payment_method_id: 'pm-2', payment_method_name: 'Tarjeta', amount: 500, amount_received: null },
      ]);

      const state = useCartStore.getState();
      expect(state.payments).toHaveLength(1);
      expect(state.payments[0].payment_method_name).toBe('Tarjeta');
    });
  });

  // ── clearCart ─────────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('resets everything to initial state', () => {
      useCartStore.getState().addLine(makeLine());
      useCartStore.getState().applyDiscount({ type: 'percentage', value: 10 });
      useCartStore.getState().setPayment([
        { payment_method_id: 'pm-1', payment_method_name: 'Efectivo', amount: 1000, amount_received: 1200 },
      ]);
      useCartStore.getState().clearCart();

      const state = useCartStore.getState();
      expect(state.lines).toEqual([]);
      expect(state.discount).toBeNull();
      expect(state.payments).toEqual([]);
      expect(state.totals.total).toBe(0);
      expect(state.totals.change).toBe(0);
    });
  });

  // ── Computed totals ──────────────────────────────────────────────────────

  describe('computed totals', () => {
    it('matches calculateSaleTotals output for a multi-line cart', () => {
      useCartStore.getState().addLine(
        makeLine({ id: 'l1', variant_id: 'v1', unit_price: 1200, quantity: 1, tax_rate: 0.16 }),
      );
      useCartStore.getState().addLine(
        makeLine({ id: 'l2', variant_id: 'v2', unit_price: 890, quantity: 1, tax_rate: 0.16 }),
      );
      useCartStore.getState().applyDiscount({ type: 'percentage', value: 10 });

      const { totals } = useCartStore.getState();

      // Compare with direct calculateSaleTotals call
      const expected = calculateSaleTotals(
        [
          { unitPrice: 1200, quantity: 1, taxRate: 0.16 },
          { unitPrice: 890, quantity: 1, taxRate: 0.16 },
        ],
        { type: 'percentage', value: 10 },
      );

      expect(totals.discount_amount).toBe(expected.discount_amount);
      expect(totals.subtotal).toBe(expected.subtotal);
      expect(totals.tax_amount).toBe(expected.tax_amount);
      expect(totals.total).toBe(expected.total);
    });

    it('maintains invariant: total = subtotal + tax_amount', () => {
      useCartStore.getState().addLine(
        makeLine({ id: 'l1', variant_id: 'v1', unit_price: 333.33, quantity: 2, tax_rate: 0.16 }),
      );
      useCartStore.getState().addLine(
        makeLine({ id: 'l2', variant_id: 'v2', unit_price: 777.77, quantity: 1, tax_rate: 0.16 }),
      );
      useCartStore.getState().applyDiscount({ type: 'percentage', value: 15 });

      const { totals } = useCartStore.getState();
      // total should equal subtotal + tax_amount (within rounding)
      expect(totals.total).toBeCloseTo(totals.subtotal + totals.tax_amount, 2);
    });

    it('returns zero totals for empty cart', () => {
      const { totals } = useCartStore.getState();
      expect(totals.raw_subtotal).toBe(0);
      expect(totals.discount_amount).toBe(0);
      expect(totals.subtotal).toBe(0);
      expect(totals.tax_amount).toBe(0);
      expect(totals.total).toBe(0);
      expect(totals.change).toBe(0);
    });
  });

  // ── Change calculation ───────────────────────────────────────────────────

  describe('change calculation', () => {
    it('calculates change for cash payment', () => {
      useCartStore.getState().addLine(
        makeLine({ unit_price: 1000, quantity: 1, tax_rate: 0.16 }),
      );
      // Total = 1000 + 160 = 1160
      useCartStore.getState().setPayment([
        {
          payment_method_id: 'pm-cash',
          payment_method_name: 'Efectivo',
          amount: 1160,
          amount_received: 1200,
        },
      ]);

      const { totals } = useCartStore.getState();
      expect(totals.change).toBe(40); // 1200 - 1160
    });

    it('returns zero change for card payment (no amount_received)', () => {
      useCartStore.getState().addLine(
        makeLine({ unit_price: 1000, quantity: 1, tax_rate: 0.16 }),
      );
      useCartStore.getState().setPayment([
        {
          payment_method_id: 'pm-card',
          payment_method_name: 'Tarjeta',
          amount: 1160,
          amount_received: null,
        },
      ]);

      const { totals } = useCartStore.getState();
      expect(totals.change).toBe(0);
    });

    it('calculates change for mixed payment with cash', () => {
      useCartStore.getState().addLine(
        makeLine({ unit_price: 1000, quantity: 1, tax_rate: 0.16 }),
      );
      // Total = 1160. Pay 660 card + 500 cash (received 600)
      useCartStore.getState().setPayment([
        {
          payment_method_id: 'pm-card',
          payment_method_name: 'Tarjeta',
          amount: 660,
          amount_received: null,
        },
        {
          payment_method_id: 'pm-cash',
          payment_method_name: 'Efectivo',
          amount: 500,
          amount_received: 600,
        },
      ]);

      const { totals } = useCartStore.getState();
      // Cash portion: amount_received(600) - amount(500) = 100
      expect(totals.change).toBe(100);
    });
  });
});
