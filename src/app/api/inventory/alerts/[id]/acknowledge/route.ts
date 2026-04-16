/**
 * API route for acknowledging a stock alert.
 *
 * PATCH /api/inventory/alerts/[id]/acknowledge — Mark alert as acknowledged
 *
 * Validates: Requirements 13.3
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { alertAcknowledgeSchema } from '@/lib/validators/inventory';
import type { UserRole } from '@/types/database';

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
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

    // Get user role and check permission (audit.view or stock.adjust)
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (
      !userProfile ||
      (!hasPermission(userProfile.role as UserRole, 'audit.view') &&
        !hasPermission(userProfile.role as UserRole, 'stock.adjust'))
    ) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para atender alertas' } },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = alertAcknowledgeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    // Verify alert exists and is active
    const { data: existingAlert, error: fetchError } = await supabase
      .from('stock_alerts')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingAlert) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Alerta no encontrada' } },
        { status: 404 }
      );
    }

    if (existingAlert.status !== 'active') {
      return NextResponse.json(
        { error: { code: 'ALREADY_ACKNOWLEDGED', message: 'La alerta ya fue atendida' } },
        { status: 409 }
      );
    }

    // Update alert to acknowledged
    const { data: updated, error: updateError } = await supabase
      .from('stock_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: user.id,
        acknowledged_note: parsed.data.note ?? null,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        id,
        variant_id,
        store_id,
        current_stock,
        threshold,
        status,
        acknowledged_by,
        acknowledged_note,
        acknowledged_at,
        created_at
      `
      )
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: updateError?.message ?? 'Error al actualizar alerta' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
}
