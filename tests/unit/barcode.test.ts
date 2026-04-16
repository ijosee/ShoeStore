import { describe, it, expect } from 'vitest';
import { validateEAN13, validateUPCA } from '@/lib/barcode/scanner';

// ─── validateEAN13 ───────────────────────────────────────────────────────────

describe('validateEAN13', () => {
  it('accepts a valid EAN-13 barcode', () => {
    // 4006381333931 is a well-known valid EAN-13
    expect(validateEAN13('4006381333931')).toBe(true);
  });

  it('accepts another valid EAN-13 barcode', () => {
    expect(validateEAN13('5901234123457')).toBe(true);
  });

  it('rejects an EAN-13 with incorrect check digit', () => {
    // Change last digit from 1 to 2
    expect(validateEAN13('4006381333932')).toBe(false);
  });

  it('rejects a string shorter than 13 digits', () => {
    expect(validateEAN13('400638133393')).toBe(false);
  });

  it('rejects a string longer than 13 digits', () => {
    expect(validateEAN13('40063813339310')).toBe(false);
  });

  it('rejects a string with non-digit characters', () => {
    expect(validateEAN13('400638133393a')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateEAN13('')).toBe(false);
  });

  it('rejects a string with spaces', () => {
    expect(validateEAN13('4006381 33931')).toBe(false);
  });

  it('validates EAN-13 starting with 0', () => {
    // 0000000000000 — check digit: (10 - (0 % 10)) % 10 = 0
    expect(validateEAN13('0000000000000')).toBe(true);
  });
});

// ─── validateUPCA ────────────────────────────────────────────────────────────

describe('validateUPCA', () => {
  it('accepts a valid UPC-A barcode', () => {
    // 012345678905 is a known valid UPC-A
    expect(validateUPCA('012345678905')).toBe(true);
  });

  it('rejects a UPC-A with incorrect check digit', () => {
    expect(validateUPCA('012345678901')).toBe(false);
  });

  it('rejects a string shorter than 12 digits', () => {
    expect(validateUPCA('01234567890')).toBe(false);
  });

  it('rejects a string longer than 12 digits', () => {
    expect(validateUPCA('0123456789050')).toBe(false);
  });

  it('rejects a string with non-digit characters', () => {
    expect(validateUPCA('01234567890a')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateUPCA('')).toBe(false);
  });

  it('validates UPC-A of all zeros', () => {
    // 000000000000 — check digit: (10 - (0 % 10)) % 10 = 0
    expect(validateUPCA('000000000000')).toBe(true);
  });
});
