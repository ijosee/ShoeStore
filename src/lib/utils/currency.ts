/**
 * Currency formatting utilities for Euro (EUR).
 *
 * Uses Intl.NumberFormat for locale-aware formatting.
 */

const eurFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a numeric amount as Euro currency string.
 *
 * Uses the format "1.200,00 €" (Spanish locale).
 *
 * @param amount - The numeric amount to format
 * @returns Formatted currency string (e.g., "149,95 €")
 */
export function formatMXN(amount: number): string {
  return eurFormatter.format(amount);
}

/**
 * Parse a formatted EUR currency string back to a number.
 *
 * Strips the euro sign, dots (thousands), and replaces comma with dot for decimal.
 *
 * @param formatted - The formatted currency string (e.g., "1.200,00 €")
 * @returns The numeric value (e.g., 1200)
 */
export function parseMXN(formatted: string): number {
  const cleaned = formatted
    .replaceAll(/[€\s]/g, '')
    .replaceAll('.', '')
    .replace(',', '.');
  const value = Number(cleaned);

  if (Number.isNaN(value)) {
    throw new TypeError(`Cannot parse "${formatted}" as a currency value`);
  }

  return value;
}
