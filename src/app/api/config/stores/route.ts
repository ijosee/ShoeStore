/**
 * API routes for store configuration.
 *
 * GET  /api/config/stores — List all stores
 * PUT  /api/config/stores — Edit a store (Admin only)
 *
 * Validates: Requirements 7.4, 8.4
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

// ─── GET /api/config/stores ──────────────────────────────────────────────────

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

    const { data: stores, error } = await supabase
      .from('stores')
      .select('*')
      .order('name');

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: stores ?? [] });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}

// ─── PUT /api/config/stores ──────────────────────────────────────────────────

export async function PUT(request: Request) {
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

    // Check admin permission
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'config.manage')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para editar tiendas' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { id, name, code, address, phone, tax_id, logo_url, return_policy_text, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'ID de tienda requerido' } },
        { status: 400 },
      );
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Nombre de tienda requerido' } },
        { status: 400 },
      );
    }

    const { data: store, error } = await supabase
      .from('stores')
      .update({
        name: name.trim(),
        code: code?.trim() ?? undefined,
        address: address?.trim() ?? null,
        phone: phone?.trim() ?? null,
        tax_id: tax_id?.trim() ?? null,
        logo_url: logo_url ?? null,
        return_policy_text: return_policy_text?.trim() ?? null,
        is_active: is_active ?? true,
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

    return NextResponse.json({ data: store });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
