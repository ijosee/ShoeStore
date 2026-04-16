/**
 * Shared validation helpers.
 *
 * Uses a relaxed UUID pattern that accepts any 8-4-4-4-12 hex string,
 * not just RFC 4122 compliant UUIDs. This is needed because our seed
 * data uses simplified UUIDs for readability.
 */

import { z } from 'zod/v4';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A relaxed UUID validator that accepts any 8-4-4-4-12 hex format.
 */
export function uuid(message?: string) {
  return z.string().regex(UUID_REGEX, message ?? 'UUID inválido');
}
