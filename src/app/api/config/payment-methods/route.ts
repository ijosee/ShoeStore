/**
 * API routes for payment method configuration.
 *
 * GET  /api/config/payment-methods — List all payment methods
 * POST /api/config/payment-methods — Create a payment method (Admin only)
 * PUT  /api/config/payment-methods — Edit a payment method (Admin only)
 *
 * Validates: Requirements 7.4, 8.4
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
        { status: 401 },
      ),
    };
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userProfile || !hasPermission(userProfile.role as UserRole, 'config.manage')) {
    return {
      error: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para gestionar métodos de pago' } },
        { status: 403 },
      ),
    };
  }

  return { user };
}

// ─── GET /api/config/payment-methods ─────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
        { status: 401 },
      );
    }

    const { data: methods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('sort_order');

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: methods ?? [] });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}

// ─── POST /api/config/payment-methods ────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await verifyAdmin(supabase);
    if ('error' in auth && auth.error) return auth.error;

    const body = await request.json();
    const { name, icon, is_active, sort_order } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Nombre del método de pago requerido' } },
        { status: 400 },
      );
    }

    const { data: method, error } = await supabase
      .from('payment_methods')
      .insert({
        name: name.trim(),
        icon: icon?.trim() ?? null,
        is_active: is_active ?? true,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'CREATE_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: method }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}

// ─── PUT /api/config/payment-methods ─────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await verifyAdmin(supabase);
    if ('error' in auth && auth.error) return auth.error;

    const body = await request.json();
    const { id, name, icon, is_active, sort_order } = body;

    if (!id) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'ID del método de pago requerido' } },
        { status: 400 },
      );
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Nombre del método de pago requerido' } },
        { status: 400 },
      );
    }

    const { data: method, error } = await supabase
      .from('payment_methods')
      .update({
        name: name.trim(),
        icon: icon?.trim() ?? null,
        is_active: is_active ?? true,
        sort_order: sort_order ?? 0,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: method });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
