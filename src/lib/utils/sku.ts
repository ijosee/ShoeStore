/**
 * SKU generation utilities for ShoeStore POS & Inventory.
 *
 * SKU pattern: {CATEGORIA_3}-{MARCA_3}-{TALLA}-{COLOR_3}
 * - First 3 characters of category, brand, and color (uppercase, no accents)
 * - Size is used as-is (e.g., "26", "26.5")
 */

/**
 * Remove diacritical marks (accents) from a string.
 * Uses Unicode NFD normalization to decompose characters, then strips combining marks.
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize a string for use in a SKU segment:
 * remove accents, convert to uppercase, take first `length` characters.
 */
function normalizeSKUSegment(value: string, length: number): string {
  return removeAccents(value).toUpperCase().slice(0, length);
}

/**
 * Generate a deterministic SKU from product attributes.
 *
 * @param category - Product category name (e.g., "Formal", "Deportivo")
 * @param brand - Brand name (e.g., "MarcaX", "Nike")
 * @param size - Size value as string (e.g., "26", "26.5")
 * @param color - Color name (e.g., "Negro", "Café")
 * @returns SKU string following the pattern {CAT_3}-{MARCA_3}-{TALLA}-{COLOR_3}
 *
 * @example
 * generateSKU("Formal", "MarcaX", "27", "Negro") // "FOR-MAR-27-NEG"
 * generateSKU("Deportivo", "Nike", "26.5", "Blanco") // "DEP-NIK-26.5-BLA"
 * generateSKU("Sandalia", "Flexi", "24", "Café") // "SAN-FLE-24-CAF"
 */
export function generateSKU(
  category: string,
  brand: string,
  size: string,
  color: string,
): string {
  const cat = normalizeSKUSegment(category, 3);
  const brd = normalizeSKUSegment(brand, 3);
  const col = normalizeSKUSegment(color, 3);
  const sz = size.trim();

  return `${cat}-${brd}-${sz}-${col}`;
}
