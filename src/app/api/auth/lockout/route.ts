/**
 * API route for account lockout management.
 *
 * Actions:
 * - check: Check if an account is currently locked
 * - record_failure: Record a failed login attempt
 * - reset: Reset failed login attempts on successful login
 *
 * Validates: Requirements 11.3
 */

import { NextResponse } from 'next/server';

import {
  checkAccountLockout,
  recordFailedLogin,
  resetFailedLogins,
} from '@/lib/auth/lockout';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'check': {
        const status = await checkAccountLockout(email);
        return NextResponse.json(status);
      }

      case 'record_failure': {
        const status = await recordFailedLogin(email);
        return NextResponse.json(status);
      }

      case 'reset': {
        await resetFailedLogins(email);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
