/**
 * API route for stock adjustments.
 *
 * POST /api/inventory/adjust — Adjust stock level for a variant in a store
 *
 * Validates: Requirements 3.8, 13.1
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { stockAdjustmentSchema } from '@/lib/validators/inventory';
import type { UserRole } from '@/types/database';

export async function POST(request: Request) {
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
        { status: 401 }
      );
    }

    // Get user role and check permission (manager/admin only)
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'stock.adjust')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para realizar ajustes de stock' } },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = stockAdjustmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de ajuste inválidos',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Call the PL/pgSQL function adjust_stock
    const { data: result, error: rpcError } = await supabase.rpc('adjust_stock', {
      adjustment_data: {
        variant_id: input.variant_id,
        store_id: input.store_id,
        new_quantity: input.new_quantity,
        reason: input.reason,
        note: input.note,
        adjusted_by: user.id,
      },
    });

    if (rpcError) {
      return NextResponse.json(
        {
          error: {
            code: 'ADJUSTMENT_ERROR',
            message: rpcError.message,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
}
