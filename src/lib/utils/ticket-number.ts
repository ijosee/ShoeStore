/**
 * Ticket number formatting utilities for ShoeStore POS & Inventory.
 *
 * Ticket numbers follow the format: {STORE_CODE}-{YEAR}-{SEQUENCE_6_DIGITS}
 * Example: TC-2024-000142
 *
 * Validates: Requirements 8.1, 8.2
 */

/**
 * Format a ticket number from its components.
 *
 * @param storeCode - Store prefix code (e.g., "TC", "TN", "TS")
 * @param year - Calendar year (e.g., 2024)
 * @param sequence - Sequential number within the store/year
 * @returns Formatted ticket number string
 *
 * @example
 * formatTicketNumber("TC", 2024, 142)   // "TC-2024-000142"
 * formatTicketNumber("TN", 2025, 1)     // "TN-2025-000001"
 * formatTicketNumber("TS", 2024, 999999) // "TS-2024-999999"
 */
export function formatTicketNumber(
  storeCode: string,
  year: number,
  sequence: number,
): string {
  const paddedSequence = String(sequence).padStart(6, '0');
  return `${storeCode}-${year}-${paddedSequence}`;
}
