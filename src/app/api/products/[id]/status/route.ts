/**
 * API route for toggling product active/inactive status.
 *
 * PATCH /api/products/[id]/status — Activate or deactivate a product (Admin only)
 *
 * Validates: Requirements 1.8
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod/v4';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

const statusSchema = z.object({
  is_active: z.boolean(),
});

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

    // Get user role and check permission
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'product.edit')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para cambiar el estado del producto' } },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El campo is_active (boolean) es requerido',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    // Verify product exists
    const { data: existing, error: existError } = await supabase
      .from('products')
      .select('id, is_active')
      .eq('id', id)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Producto no encontrado' } },
        { status: 404 }
      );
    }

    // Update status
    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({
        is_active: parsed.data.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name, is_active, updated_at')
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: updateError?.message ?? 'Error al actualizar estado' } },
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
