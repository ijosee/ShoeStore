import { describe, it, expect } from 'vitest';
import { formatMXN, parseMXN } from '@/lib/utils/currency';

// ─── formatMXN ───────────────────────────────────────────────────────────────

describe('formatMXN', () => {
  it('formats a standard amount', () => {
    expect(formatMXN(1200)).toBe('$1,200.00');
  });

  it('formats zero', () => {
    expect(formatMXN(0)).toBe('$0.00');
  });

  it('formats cents', () => {
    expect(formatMXN(0.5)).toBe('$0.50');
    expect(formatMXN(0.01)).toBe('$0.01');
  });

  it('formats large amounts with comma separators', () => {
    expect(formatMXN(1000000)).toBe('$1,000,000.00');
  });

  it('formats negative amounts', () => {
    expect(formatMXN(-209)).toBe('-$209.00');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatMXN(1200.999)).toBe('$1,201.00');
    expect(formatMXN(1200.005)).toBe('$1,200.01');
  });
});

// ─── parseMXN ────────────────────────────────────────────────────────────────

describe('parseMXN', () => {
  it('parses a formatted currency string', () => {
    expect(parseMXN('$1,200.00')).toBe(1200);
  });

  it('parses zero', () => {
    expect(parseMXN('$0.00')).toBe(0);
  });

  it('parses cents', () => {
    expect(parseMXN('$0.50')).toBe(0.5);
  });

  it('parses a string without dollar sign', () => {
    expect(parseMXN('1200.00')).toBe(1200);
  });

  it('parses a string without commas', () => {
    expect(parseMXN('$1200.00')).toBe(1200);
  });

  it('parses large amounts', () => {
    expect(parseMXN('$1,000,000.00')).toBe(1000000);
  });

  it('throws on invalid input', () => {
    expect(() => parseMXN('abc')).toThrow('Cannot parse');
  });

  it('roundtrips with formatMXN', () => {
    const amount = 2424.40;
    expect(parseMXN(formatMXN(amount))).toBe(amount);
  });
});
