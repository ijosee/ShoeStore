/**
 * Tax calculation utilities for ShoeStore POS & Inventory.
 *
 * Implements IVA calculations, sale totals, and proportional discount distribution.
 * All monetary amounts are rounded to 2 decimals using ROUND_HALF_UP.
 *
 * Validates: Requirements 6.5, 6.7, 6.8
 */

// ─── Rounding ────────────────────────────────────────────────────────────────

/**
 * Round a number using the ROUND_HALF_UP strategy.
 *
 * Standard `Math.round` already rounds 0.5 up for positive numbers,
 * but floating-point representation can cause issues (e.g., 1.005 → 1.00
 * instead of 1.01). We use an epsilon-adjusted approach to handle this.
 *
 * @param value - The number to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns The rounded number
 *
 * @example
 * roundHalfUp(1.005)    // 1.01
 * roundHalfUp(1.004)    // 1.00
 * roundHalfUp(2.555)    // 2.56
 * roundHalfUp(1.2345, 3) // 1.235
 */
export function roundHalfUp(value: number, decimals: number = 2): number {
  // Use string-based exponent shifting to avoid floating-point representation issues.
  // For example, 1.005 * 100 = 100.49999... in IEEE 754, but
  // Number('1.005e2') = 100.5 which rounds correctly.
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const shifted = Number(abs + 'e' + decimals);
  const rounded = Math.round(shifted);
  return sign * Number(rounded + 'e-' + decimals);
}

// ─── Line totals ─────────────────────────────────────────────────────────────

export interface LineTotals {
  line_subtotal: number;
  line_tax: number;
  line_total: number;
}

/**
 * Calculate totals for a single sale line.
 *
 * line_subtotal = (unitPrice × quantity) - lineDiscount
 * line_tax = roundHalfUp(line_subtotal × taxRate)
 * line_total = line_subtotal + line_tax
 *
 * @param unitPrice - Price per unit
 * @param quantity - Number of units
 * @param taxRate - Tax rate as a decimal (e.g., 0.16 for 16%)
 * @param lineDiscount - Discount amount applied to this line (default: 0)
 * @returns Object with line_subtotal, line_tax, line_total
 *
 * @example
 * calculateLineTotals(1200, 1, 0.16, 120)
 * // { line_subtotal: 1080, line_tax: 172.80, line_total: 1252.80 }
 */
export function calculateLineTotals(
  unitPrice: number,
  quantity: number,
  taxRate: number,
  lineDiscount: number = 0,
): LineTotals {
  const line_subtotal = roundHalfUp(unitPrice * quantity - lineDiscount);
  const line_tax = roundHalfUp(line_subtotal * taxRate);
  const line_total = roundHalfUp(line_subtotal + line_tax);

  return { line_subtotal, line_tax, line_total };
}

// ─── Discount distribution ───────────────────────────────────────────────────

export interface DiscountLine {
  unitPrice: number;
  quantity: number;
}

/**
 * Distribute a global discount proportionally across sale lines.
 *
 * Each line receives a share of the discount proportional to its raw subtotal
 * (unitPrice × quantity) relative to the total raw subtotal.
 *
 * The LAST line receives the remainder to ensure the sum of distributed
 * discounts equals exactly the total discount amount (no penny loss).
 *
 * @param lines - Array of line items with unitPrice and quantity
 * @param discountAmount - Total discount to distribute
 * @returns Array of discount amounts per line (same order as input)
 *
 * @example
 * distributeDiscount(
 *   [{ unitPrice: 1200, quantity: 1 }, { unitPrice: 890, quantity: 1 }],
 *   209
 * )
 * // [120.00, 89.00]
 */
export function distributeDiscount(
  lines: DiscountLine[],
  discountAmount: number,
): number[] {
  if (lines.length === 0) return [];
  if (discountAmount === 0) return lines.map(() => 0);

  const rawSubtotals = lines.map((l) => l.unitPrice * l.quantity);
  const totalRawSubtotal = rawSubtotals.reduce((sum, s) => sum + s, 0);

  if (totalRawSubtotal === 0) return lines.map(() => 0);

  const discounts: number[] = [];
  let distributed = 0;

  for (let i = 0; i < lines.length; i++) {
    if (i === lines.length - 1) {
      // Last line gets the remainder to avoid penny loss
      discounts.push(roundHalfUp(discountAmount - distributed));
    } else {
      const share = roundHalfUp(discountAmount * (rawSubtotals[i] / totalRawSubtotal));
      discounts.push(share);
      distributed += share;
    }
  }

  return discounts;
}

// ─── Sale totals ─────────────────────────────────────────────────────────────

export interface SaleLine {
  unitPrice: number;
  quantity: number;
  taxRate: number;
  lineDiscount?: number;
}

export interface SaleDiscount {
  type: 'percentage' | 'fixed_amount';
  value: number;
}

export interface SaleLineTotals {
  line_subtotal: number;
  line_tax: number;
  line_total: number;
  line_discount: number;
}

export interface SaleTotals {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  line_totals: SaleLineTotals[];
}

// ─── Refund calculation ──────────────────────────────────────────────────────

/**
 * Calculate the proportional refund amount for a partial or full return.
 *
 * Formula: ROUND(line_total × (returnQuantity / saleLine.quantity), 2)
 *
 * For a full return (returnQuantity === saleLine.quantity), the refund equals
 * the original line_total exactly.
 *
 * @param saleLine - The original sale line with quantity and line_total
 * @param returnQuantity - Number of units being returned
 * @returns The refund amount rounded to 2 decimals
 * @throws Error if returnQuantity exceeds saleLine.quantity
 * @throws Error if returnQuantity is not greater than 0
 *
 * Validates: Requirements 9.4
 *
 * @example
 * calculateRefund({ quantity: 1, line_total: 929.16 }, 1) // 929.16
 * calculateRefund({ quantity: 3, line_total: 900 }, 1)    // 300
 */
export function calculateRefund(
  saleLine: { quantity: number; line_total: number },
  returnQuantity: number,
): number {
  if (returnQuantity <= 0) {
    throw new Error('Return quantity must be greater than 0');
  }
  if (returnQuantity > saleLine.quantity) {
    throw new Error(
      `Return quantity (${returnQuantity}) exceeds sold quantity (${saleLine.quantity})`,
    );
  }

  return roundHalfUp(saleLine.line_total * (returnQuantity / saleLine.quantity));
}

/**
 * Calculate complete sale totals including discount distribution and tax.
 *
 * Flow:
 * 1. Calculate raw subtotal (sum of unitPrice × quantity for all lines)
 * 2. Calculate discount_amount based on discount type
 * 3. Distribute discount proportionally across lines
 * 4. Calculate each line's totals with distributed discount + per-line discount
 * 5. Sum up subtotal, tax, total
 *
 * Invariants:
 * - total = subtotal + tax_amount
 * - total >= 0
 * - sum of line_discounts = discount_amount
 *
 * @param lines - Array of sale line items
 * @param discount - Optional sale-level discount
 * @returns Complete sale totals with per-line breakdown
 *
 * @example
 * calculateSaleTotals(
 *   [
 *     { unitPrice: 1200, quantity: 1, taxRate: 0.16 },
 *     { unitPrice: 890, quantity: 1, taxRate: 0.16 },
 *   ],
 *   { type: 'percentage', value: 10 }
 * )
 * // { subtotal: 1881, discount_amount: 209, tax_amount: 300.96, total: 2181.96, ... }
 */
export function calculateSaleTotals(
  lines: SaleLine[],
  discount?: SaleDiscount,
): SaleTotals {
  // 1. Calculate raw subtotal
  const rawSubtotal = lines.reduce(
    (sum, l) => sum + l.unitPrice * l.quantity,
    0,
  );

  // 2. Calculate discount amount
  let discount_amount = 0;
  if (discount) {
    if (discount.type === 'percentage') {
      discount_amount = roundHalfUp(rawSubtotal * (discount.value / 100));
    } else {
      discount_amount = roundHalfUp(discount.value);
    }
  }

  // Cap discount at raw subtotal to prevent negative totals
  discount_amount = Math.min(discount_amount, rawSubtotal);

  // 3. Distribute global discount across lines
  const distributedDiscounts = distributeDiscount(
    lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
    discount_amount,
  );

  // 4. Calculate each line's totals
  const line_totals: SaleLineTotals[] = lines.map((line, i) => {
    const totalLineDiscount = distributedDiscounts[i] + (line.lineDiscount ?? 0);
    const lineTotals = calculateLineTotals(
      line.unitPrice,
      line.quantity,
      line.taxRate,
      totalLineDiscount,
    );

    return {
      line_subtotal: lineTotals.line_subtotal,
      line_tax: lineTotals.line_tax,
      line_total: lineTotals.line_total,
      line_discount: distributedDiscounts[i],
    };
  });

  // 5. Sum up totals
  const subtotal = roundHalfUp(
    line_totals.reduce((sum, l) => sum + l.line_subtotal, 0),
  );
  const tax_amount = roundHalfUp(
    line_totals.reduce((sum, l) => sum + l.line_tax, 0),
  );
  const total = roundHalfUp(subtotal + tax_amount);

  return {
    subtotal,
    discount_amount,
    tax_amount,
    total,
    line_totals,
  };
}
