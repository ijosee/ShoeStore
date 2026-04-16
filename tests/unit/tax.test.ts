/**
 * Unit tests for tax calculation utilities.
 *
 * Covers: roundHalfUp, calculateLineTotals, distributeDiscount,
 * calculateSaleTotals, and formatTicketNumber.
 *
 * Validates: Requirements 6.5, 6.7, 6.8, 8.1
 */

import { describe, it, expect } from 'vitest';
import {
  roundHalfUp,
  calculateLineTotals,
  distributeDiscount,
  calculateSaleTotals,
  calculateRefund,
} from '@/lib/utils/tax';
import { formatTicketNumber } from '@/lib/utils/ticket-number';

// ─── roundHalfUp ─────────────────────────────────────────────────────────────

describe('roundHalfUp', () => {
  it('rounds 1.005 up to 1.01', () => {
    expect(roundHalfUp(1.005)).toBe(1.01);
  });

  it('rounds 1.004 down to 1.00', () => {
    expect(roundHalfUp(1.004)).toBe(1.0);
  });

  it('rounds 2.555 up to 2.56', () => {
    expect(roundHalfUp(2.555)).toBe(2.56);
  });

  it('rounds 0.005 up to 0.01', () => {
    expect(roundHalfUp(0.005)).toBe(0.01);
  });

  it('handles exact values without change', () => {
    expect(roundHalfUp(1.23)).toBe(1.23);
    expect(roundHalfUp(100.0)).toBe(100.0);
    expect(roundHalfUp(0)).toBe(0);
  });

  it('handles negative values', () => {
    // ROUND_HALF_UP rounds the absolute value, then restores sign
    expect(roundHalfUp(-1.005)).toBe(-1.01);
    expect(roundHalfUp(-1.004)).toBe(-1.0);
    expect(roundHalfUp(-1.006)).toBe(-1.01);
  });

  it('supports custom decimal places', () => {
    expect(roundHalfUp(1.2345, 3)).toBe(1.235);
    expect(roundHalfUp(1.2344, 3)).toBe(1.234);
    expect(roundHalfUp(1.5, 0)).toBe(2);
  });

  it('handles large numbers', () => {
    expect(roundHalfUp(99999.995)).toBe(100000.0);
    expect(roundHalfUp(12345.674)).toBe(12345.67);
  });
});

// ─── calculateLineTotals ─────────────────────────────────────────────────────

describe('calculateLineTotals', () => {
  it('calculates line with 16% IVA and no discount', () => {
    const result = calculateLineTotals(1200, 1, 0.16);
    expect(result.line_subtotal).toBe(1200);
    expect(result.line_tax).toBe(192);
    expect(result.line_total).toBe(1392);
  });

  it('calculates line with discount (Journey 3.2 line 1)', () => {
    const result = calculateLineTotals(1200, 1, 0.16, 120);
    expect(result.line_subtotal).toBe(1080);
    expect(result.line_tax).toBe(172.8);
    expect(result.line_total).toBe(1252.8);
  });

  it('calculates line with discount (Journey 3.2 line 2)', () => {
    const result = calculateLineTotals(890, 1, 0.16, 89);
    expect(result.line_subtotal).toBe(801);
    expect(result.line_tax).toBe(128.16);
    expect(result.line_total).toBe(929.16);
  });

  it('handles quantity > 1', () => {
    const result = calculateLineTotals(500, 3, 0.16);
    expect(result.line_subtotal).toBe(1500);
    expect(result.line_tax).toBe(240);
    expect(result.line_total).toBe(1740);
  });

  it('handles zero tax rate', () => {
    const result = calculateLineTotals(100, 2, 0);
    expect(result.line_subtotal).toBe(200);
    expect(result.line_tax).toBe(0);
    expect(result.line_total).toBe(200);
  });

  it('handles zero price', () => {
    const result = calculateLineTotals(0, 5, 0.16);
    expect(result.line_subtotal).toBe(0);
    expect(result.line_tax).toBe(0);
    expect(result.line_total).toBe(0);
  });

  it('defaults lineDiscount to 0', () => {
    const result = calculateLineTotals(100, 1, 0.16);
    expect(result.line_subtotal).toBe(100);
  });

  it('handles 8% tax rate', () => {
    const result = calculateLineTotals(1000, 1, 0.08);
    expect(result.line_subtotal).toBe(1000);
    expect(result.line_tax).toBe(80);
    expect(result.line_total).toBe(1080);
  });
});

// ─── distributeDiscount ──────────────────────────────────────────────────────

describe('distributeDiscount', () => {
  it('distributes proportionally (Journey 3.2 example)', () => {
    const lines = [
      { unitPrice: 1200, quantity: 1 },
      { unitPrice: 890, quantity: 1 },
    ];
    const result = distributeDiscount(lines, 209);
    expect(result[0]).toBe(120.0);
    expect(result[1]).toBe(89.0);
    expect(result[0] + result[1]).toBe(209);
  });

  it('handles single line — gets full discount', () => {
    const lines = [{ unitPrice: 500, quantity: 2 }];
    const result = distributeDiscount(lines, 100);
    expect(result).toEqual([100]);
  });

  it('handles zero discount', () => {
    const lines = [
      { unitPrice: 100, quantity: 1 },
      { unitPrice: 200, quantity: 1 },
    ];
    const result = distributeDiscount(lines, 0);
    expect(result).toEqual([0, 0]);
  });

  it('handles empty lines array', () => {
    const result = distributeDiscount([], 100);
    expect(result).toEqual([]);
  });

  it('avoids penny loss with 3 equal lines', () => {
    // 100 / 3 = 33.33 each, but 33.33 * 3 = 99.99 — last line gets 33.34
    const lines = [
      { unitPrice: 100, quantity: 1 },
      { unitPrice: 100, quantity: 1 },
      { unitPrice: 100, quantity: 1 },
    ];
    const result = distributeDiscount(lines, 100);
    const sum = result.reduce((s, d) => s + d, 0);
    expect(roundHalfUp(sum)).toBe(100);
    expect(result[0]).toBe(33.33);
    expect(result[1]).toBe(33.33);
    expect(result[2]).toBe(33.34);
  });

  it('handles lines with different quantities', () => {
    const lines = [
      { unitPrice: 100, quantity: 3 }, // raw = 300
      { unitPrice: 200, quantity: 1 }, // raw = 200
    ];
    // total raw = 500, discount = 50
    // line 1: 50 * (300/500) = 30
    // line 2: 50 - 30 = 20
    const result = distributeDiscount(lines, 50);
    expect(result[0]).toBe(30);
    expect(result[1]).toBe(20);
  });

  it('handles zero-price lines gracefully', () => {
    const lines = [
      { unitPrice: 0, quantity: 1 },
      { unitPrice: 0, quantity: 1 },
    ];
    const result = distributeDiscount(lines, 10);
    expect(result).toEqual([0, 0]);
  });
});

// ─── calculateSaleTotals ────────────────────────────────────────────────────

describe('calculateSaleTotals', () => {
  it('matches Journey 3.2 example with 10% discount', () => {
    const result = calculateSaleTotals(
      [
        { unitPrice: 1200, quantity: 1, taxRate: 0.16 },
        { unitPrice: 890, quantity: 1, taxRate: 0.16 },
      ],
      { type: 'percentage', value: 10 },
    );

    expect(result.discount_amount).toBe(209);
    expect(result.subtotal).toBe(1881);
    expect(result.tax_amount).toBe(300.96);
    expect(result.total).toBe(2181.96);

    // Line 1
    expect(result.line_totals[0].line_discount).toBe(120);
    expect(result.line_totals[0].line_subtotal).toBe(1080);
    expect(result.line_totals[0].line_tax).toBe(172.8);
    expect(result.line_totals[0].line_total).toBe(1252.8);

    // Line 2
    expect(result.line_totals[1].line_discount).toBe(89);
    expect(result.line_totals[1].line_subtotal).toBe(801);
    expect(result.line_totals[1].line_tax).toBe(128.16);
    expect(result.line_totals[1].line_total).toBe(929.16);
  });

  it('calculates without discount', () => {
    const result = calculateSaleTotals([
      { unitPrice: 1200, quantity: 1, taxRate: 0.16 },
      { unitPrice: 890, quantity: 1, taxRate: 0.16 },
    ]);

    expect(result.discount_amount).toBe(0);
    expect(result.subtotal).toBe(2090);
    expect(result.tax_amount).toBe(334.4);
    expect(result.total).toBe(2424.4);
  });

  it('calculates with fixed_amount discount', () => {
    const result = calculateSaleTotals(
      [{ unitPrice: 1000, quantity: 1, taxRate: 0.16 }],
      { type: 'fixed_amount', value: 200 },
    );

    expect(result.discount_amount).toBe(200);
    expect(result.subtotal).toBe(800);
    expect(result.tax_amount).toBe(128);
    expect(result.total).toBe(928);
  });

  it('handles 100% discount', () => {
    const result = calculateSaleTotals(
      [{ unitPrice: 500, quantity: 2, taxRate: 0.16 }],
      { type: 'percentage', value: 100 },
    );

    expect(result.discount_amount).toBe(1000);
    expect(result.subtotal).toBe(0);
    expect(result.tax_amount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles zero discount', () => {
    const result = calculateSaleTotals(
      [{ unitPrice: 100, quantity: 1, taxRate: 0.16 }],
      { type: 'percentage', value: 0 },
    );

    expect(result.discount_amount).toBe(0);
    expect(result.subtotal).toBe(100);
    expect(result.tax_amount).toBe(16);
    expect(result.total).toBe(116);
  });

  it('caps fixed discount at raw subtotal', () => {
    const result = calculateSaleTotals(
      [{ unitPrice: 100, quantity: 1, taxRate: 0.16 }],
      { type: 'fixed_amount', value: 500 },
    );

    expect(result.discount_amount).toBe(100);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles single line with per-line discount', () => {
    const result = calculateSaleTotals([
      { unitPrice: 1000, quantity: 1, taxRate: 0.16, lineDiscount: 50 },
    ]);

    expect(result.discount_amount).toBe(0);
    expect(result.subtotal).toBe(950);
    expect(result.tax_amount).toBe(152);
    expect(result.total).toBe(1102);
  });

  it('handles mixed tax rates', () => {
    const result = calculateSaleTotals([
      { unitPrice: 1000, quantity: 1, taxRate: 0.16 },
      { unitPrice: 500, quantity: 1, taxRate: 0.08 },
    ]);

    expect(result.subtotal).toBe(1500);
    expect(result.tax_amount).toBe(200); // 160 + 40
    expect(result.total).toBe(1700);
  });

  it('maintains invariant: total = subtotal + tax_amount', () => {
    const result = calculateSaleTotals(
      [
        { unitPrice: 333.33, quantity: 3, taxRate: 0.16 },
        { unitPrice: 777.77, quantity: 2, taxRate: 0.08 },
      ],
      { type: 'percentage', value: 15 },
    );

    expect(result.total).toBe(roundHalfUp(result.subtotal + result.tax_amount));
  });

  it('maintains invariant: sum of line_discounts = discount_amount', () => {
    const result = calculateSaleTotals(
      [
        { unitPrice: 100, quantity: 1, taxRate: 0.16 },
        { unitPrice: 200, quantity: 1, taxRate: 0.16 },
        { unitPrice: 300, quantity: 1, taxRate: 0.16 },
      ],
      { type: 'percentage', value: 33 },
    );

    const sumLineDiscounts = result.line_totals.reduce(
      (sum, l) => sum + l.line_discount,
      0,
    );
    expect(roundHalfUp(sumLineDiscounts)).toBe(result.discount_amount);
  });

  it('maintains invariant: total >= 0', () => {
    const result = calculateSaleTotals(
      [{ unitPrice: 10, quantity: 1, taxRate: 0.16 }],
      { type: 'fixed_amount', value: 9999 },
    );

    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});

// ─── formatTicketNumber ──────────────────────────────────────────────────────

describe('formatTicketNumber', () => {
  it('formats with zero-padded sequence (Journey 3.2)', () => {
    expect(formatTicketNumber('TC', 2024, 142)).toBe('TC-2024-000142');
  });

  it('pads single digit sequence', () => {
    expect(formatTicketNumber('TN', 2025, 1)).toBe('TN-2025-000001');
  });

  it('handles max 6-digit sequence', () => {
    expect(formatTicketNumber('TS', 2024, 999999)).toBe('TS-2024-999999');
  });

  it('handles sequence exceeding 6 digits', () => {
    expect(formatTicketNumber('TC', 2024, 1000000)).toBe('TC-2024-1000000');
  });

  it('works with different store codes', () => {
    expect(formatTicketNumber('TC', 2024, 1)).toBe('TC-2024-000001');
    expect(formatTicketNumber('TN', 2024, 1)).toBe('TN-2024-000001');
    expect(formatTicketNumber('TS', 2024, 1)).toBe('TS-2024-000001');
  });
});


// ─── calculateRefund ─────────────────────────────────────────────────────────

describe('calculateRefund', () => {
  it('returns full line_total for full return (returnQuantity = quantity)', () => {
    const result = calculateRefund({ quantity: 3, line_total: 900 }, 3);
    expect(result).toBe(900);
  });

  it('calculates proportional refund for partial return (1 of 3)', () => {
    const result = calculateRefund({ quantity: 3, line_total: 900 }, 1);
    expect(result).toBe(300);
  });

  it('matches Journey 3.3 example: line_total=929.16, quantity=1, return 1', () => {
    const result = calculateRefund({ quantity: 1, line_total: 929.16 }, 1);
    expect(result).toBe(929.16);
  });

  it('throws error when return quantity exceeds sold quantity', () => {
    expect(() =>
      calculateRefund({ quantity: 2, line_total: 500 }, 3),
    ).toThrow('Return quantity (3) exceeds sold quantity (2)');
  });

  it('throws error when return quantity is 0', () => {
    expect(() =>
      calculateRefund({ quantity: 2, line_total: 500 }, 0),
    ).toThrow('Return quantity must be greater than 0');
  });

  it('throws error when return quantity is negative', () => {
    expect(() =>
      calculateRefund({ quantity: 2, line_total: 500 }, -1),
    ).toThrow('Return quantity must be greater than 0');
  });

  it('rounds proportional refund to 2 decimals', () => {
    // 1000 * (1/3) = 333.333... → 333.33
    const result = calculateRefund({ quantity: 3, line_total: 1000 }, 1);
    expect(result).toBe(333.33);
  });

  it('handles returning 2 of 3 items', () => {
    // 900 * (2/3) = 600
    const result = calculateRefund({ quantity: 3, line_total: 900 }, 2);
    expect(result).toBe(600);
  });
});
