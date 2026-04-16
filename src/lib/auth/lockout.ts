/**
 * Account lockout logic for failed login attempts.
 *
 * - Checks if account is locked before allowing login
 * - Increments failed_login_attempts on failed login
 * - Resets failed_login_attempts on successful login
 * - Sets locked_until to now() + 15 minutes when attempts reach 5
 *
 * Validates: Requirements 11.3
 */

import { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export interface LockoutStatus {
  is_locked: boolean;
  locked_until: string | null;
  failed_attempts: number;
}

/**
 * Check if a user account is currently locked.
 * Returns lockout status including remaining lock time.
 */
export async function checkAccountLockout(
  email: string
): Promise<LockoutStatus> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select('failed_login_attempts, locked_until')
    .eq('email', email)
    .single();

  if (error || !data) {
    // User not found in our users table — not locked
    return { is_locked: false, locked_until: null, failed_attempts: 0 };
  }

  const { failed_login_attempts, locked_until } = data;

  // Check if currently locked
  if (locked_until) {
    const lockExpiry = new Date(locked_until);
    if (lockExpiry > new Date()) {
      return {
        is_locked: true,
        locked_until,
        failed_attempts: failed_login_attempts,
      };
    }
  }

  return {
    is_locked: false,
    locked_until: null,
    failed_attempts: failed_login_attempts,
  };
}

/**
 * Record a failed login attempt.
 * Increments the counter and locks the account if threshold is reached.
 */
export async function recordFailedLogin(email: string): Promise<LockoutStatus> {
  const supabase = await createClient();

  // Get current attempts
  const { data, error } = await supabase
    .from('users')
    .select('failed_login_attempts, locked_until')
    .eq('email', email)
    .single();

  if (error || !data) {
    return { is_locked: false, locked_until: null, failed_attempts: 0 };
  }

  const newAttempts = data.failed_login_attempts + 1;

  // If reaching the max, lock the account
  if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
    const lockUntil = new Date(
      Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
    ).toISOString();

    await supabase
      .from('users')
      .update({
        failed_login_attempts: newAttempts,
        locked_until: lockUntil,
      })
      .eq('email', email);

    return {
      is_locked: true,
      locked_until: lockUntil,
      failed_attempts: newAttempts,
    };
  }

  // Otherwise just increment
  await supabase
    .from('users')
    .update({ failed_login_attempts: newAttempts })
    .eq('email', email);

  return {
    is_locked: false,
    locked_until: null,
    failed_attempts: newAttempts,
  };
}

/**
 * Reset failed login attempts on successful login.
 */
export async function resetFailedLogins(email: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('users')
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq('email', email);
}
