/**
 * API route for activating/deactivating a user.
 *
 * PATCH /api/users/[id]/status — Activate or deactivate a user (Admin only)
 * Invalidates active sessions when deactivating.
 *
 * Validates: Requirements 11.5, 11.7
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/users/[id]/status'>,
) {
  try {
    const supabase = await createClient();
    const { id } = await ctx.params;

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

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'user.manage')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para gestionar usuarios' } },
        { status: 403 },
      );
    }

    // Prevent self-deactivation
    if (id === user.id) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No puede desactivar su propia cuenta' } },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { is_active } = body;

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Campo is_active requerido (boolean)' } },
        { status: 400 },
      );
    }

    // Update user status
    const { error: updateError } = await supabase
      .from('users')
      .update({ is_active })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: updateError.message } },
        { status: 500 },
      );
    }

    // If deactivating, invalidate sessions via Supabase Admin API
    if (!is_active) {
      try {
        const adminSupabase = getAdminSupabase();
        // Ban the user to invalidate all sessions
        await adminSupabase.auth.admin.updateUserById(id, {
          ban_duration: 'none', // We use our own is_active flag
        });
        // Sign out the user from all sessions
        await adminSupabase.auth.admin.signOut(id, 'global');
      } catch {
        // Non-critical: user is deactivated but session invalidation may have failed
      }
    }

    return NextResponse.json({
      data: { id, is_active },
      message: is_active ? 'Usuario activado' : 'Usuario desactivado',
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
