/**
 * Barcode validation utilities for ShoeStore POS & Inventory.
 *
 * Supports EAN-13 (13 digits) and UPC-A (12 digits) barcode formats.
 * Validates both the digit format and the check digit using the standard algorithms.
 */

/**
 * Validate an EAN-13 barcode string.
 *
 * EAN-13 is a 13-digit barcode standard. The last digit is a check digit
 * calculated from the first 12 digits using alternating weights of 1 and 3.
 *
 * Algorithm:
 * 1. Sum odd-position digits (1st, 3rd, ..., 11th) × 1
 * 2. Sum even-position digits (2nd, 4th, ..., 12th) × 3
 * 3. Check digit = (10 - (sum % 10)) % 10
 * 4. Must equal the 13th digit
 *
 * @param barcode - The barcode string to validate
 * @returns true if the barcode is a valid EAN-13
 *
 * @example
 * validateEAN13("4006381333931") // true
 * validateEAN13("1234567890123") // false (invalid check digit)
 * validateEAN13("12345")         // false (wrong length)
 */
export function validateEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;

  const digits = barcode.split('').map(Number);
  const checksum = digits
    .slice(0, 12)
    .reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0);

  return (10 - (checksum % 10)) % 10 === digits[12];
}

/**
 * Validate a UPC-A barcode string.
 *
 * UPC-A is a 12-digit barcode standard used primarily in North America.
 * The last digit is a check digit calculated from the first 11 digits
 * using alternating weights of 3 and 1.
 *
 * Algorithm:
 * 1. Sum odd-position digits (1st, 3rd, ..., 11th) × 3
 * 2. Sum even-position digits (2nd, 4th, ..., 10th) × 1
 * 3. Check digit = (10 - (sum % 10)) % 10
 * 4. Must equal the 12th digit
 *
 * @param barcode - The barcode string to validate
 * @returns true if the barcode is a valid UPC-A
 *
 * @example
 * validateUPCA("012345678905") // true
 * validateUPCA("123456789012") // false (invalid check digit)
 */
export function validateUPCA(barcode: string): boolean {
  if (!/^\d{12}$/.test(barcode)) return false;

  const digits = barcode.split('').map(Number);
  const checksum = digits
    .slice(0, 11)
    .reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 3 : 1), 0);

  return (10 - (checksum % 10)) % 10 === digits[11];
}
