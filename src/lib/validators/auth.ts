/**
 * Zod validation schemas for authentication and user management.
 *
 * Validates: Requirements 11.1, 11.2, 11.5
 */

import { z } from 'zod/v4';

import { uuid } from '@/lib/validators/helpers';
import { PASSWORD_MIN_LENGTH } from '@/lib/constants';
import type { UserRole } from '@/types/database';

// ─── Password policy ─────────────────────────────────────────────────────────

const PASSWORD_REGEX = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /\d/,
  special: /[^A-Za-z0-9]/,
};

/**
 * Standalone password validation function.
 *
 * Returns `true` when the password meets all policy requirements:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character
 *
 * Requirement 11.2
 */
export function validatePassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < PASSWORD_MIN_LENGTH) return false;
  if (!PASSWORD_REGEX.uppercase.test(password)) return false;
  if (!PASSWORD_REGEX.lowercase.test(password)) return false;
  if (!PASSWORD_REGEX.digit.test(password)) return false;
  if (!PASSWORD_REGEX.special.test(password)) return false;
  return true;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

/** Schema for the password field with full policy enforcement. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .regex(PASSWORD_REGEX.uppercase, 'La contraseña debe contener al menos una letra mayúscula')
  .regex(PASSWORD_REGEX.lowercase, 'La contraseña debe contener al menos una letra minúscula')
  .regex(PASSWORD_REGEX.digit, 'La contraseña debe contener al menos un número')
  .regex(PASSWORD_REGEX.special, 'La contraseña debe contener al menos un carácter especial');

/** Schema for user login. Requirement 11.1 */
export const loginSchema = z.object({
  email: z.email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Schema for creating a new user. Requirement 11.5 */
export const createUserSchema = z.object({
  full_name: z
    .string()
    .min(1, 'El nombre completo es requerido')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  email: z.email('Correo electrónico inválido'),
  role: z.enum(['admin', 'manager', 'seller'] as const satisfies readonly UserRole[]),
  store_ids: z
    .array(uuid('ID de tienda inválido'))
    .min(1, 'Debe asignar al menos una tienda'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
