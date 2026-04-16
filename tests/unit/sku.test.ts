import { describe, it, expect } from 'vitest';
import { generateSKU, removeAccents } from '@/lib/utils/sku';

// ─── removeAccents ───────────────────────────────────────────────────────────

describe('removeAccents', () => {
  it('removes common Spanish accents', () => {
    expect(removeAccents('Café')).toBe('Cafe');
    expect(removeAccents('Depórtivo')).toBe('Deportivo');
    expect(removeAccents('señor')).toBe('senor');
  });

  it('leaves ASCII strings unchanged', () => {
    expect(removeAccents('Negro')).toBe('Negro');
    expect(removeAccents('ABC')).toBe('ABC');
  });

  it('handles empty string', () => {
    expect(removeAccents('')).toBe('');
  });

  it('removes accents from all vowels', () => {
    expect(removeAccents('áéíóú')).toBe('aeiou');
    expect(removeAccents('ÁÉÍÓÚ')).toBe('AEIOU');
  });

  it('handles ñ and ü', () => {
    expect(removeAccents('niño')).toBe('nino');
    expect(removeAccents('güero')).toBe('guero');
  });
});

// ─── generateSKU ─────────────────────────────────────────────────────────────

describe('generateSKU', () => {
  it('generates SKU from design doc examples', () => {
    expect(generateSKU('Formal', 'MarcaX', '27', 'Negro')).toBe('FOR-MAR-27-NEG');
    expect(generateSKU('Deportivo', 'Nike', '26.5', 'Blanco')).toBe('DEP-NIK-26.5-BLA');
    expect(generateSKU('Sandalia', 'Flexi', '24', 'Rojo')).toBe('SAN-FLE-24-ROJ');
  });

  it('removes accents from category, brand, and color', () => {
    expect(generateSKU('Clásico', 'Línea', '28', 'Café')).toBe('CLA-LIN-28-CAF');
  });

  it('converts to uppercase', () => {
    expect(generateSKU('formal', 'marcax', '27', 'negro')).toBe('FOR-MAR-27-NEG');
  });

  it('takes first 3 characters of category, brand, and color', () => {
    expect(generateSKU('De', 'AB', '26', 'Ro')).toBe('DE-AB-26-RO');
  });

  it('uses size as-is including decimals', () => {
    expect(generateSKU('Formal', 'Nike', '26.5', 'Negro')).toBe('FOR-NIK-26.5-NEG');
  });

  it('is deterministic — same inputs produce same output', () => {
    const sku1 = generateSKU('Formal', 'MarcaX', '27', 'Negro');
    const sku2 = generateSKU('Formal', 'MarcaX', '27', 'Negro');
    expect(sku1).toBe(sku2);
  });

  it('trims whitespace from size', () => {
    expect(generateSKU('Formal', 'Nike', ' 27 ', 'Negro')).toBe('FOR-NIK-27-NEG');
  });
});
