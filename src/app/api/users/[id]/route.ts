/**
 * API route for editing a specific user.
 *
 * PUT /api/users/[id] — Edit user profile (Admin only)
 *
 * Validates: Requirements 11.5, 11.7
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

export async function PUT(
  request: Request,
  ctx: RouteContext<'/api/users/[id]'>,
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
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para editar usuarios' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { full_name, role, store_ids } = body;

    // Validate
    if (!full_name?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Nombre completo requerido' } },
        { status: 400 },
      );
    }
    if (role && !['admin', 'manager', 'seller'].includes(role)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Rol inválido' } },
        { status: 400 },
      );
    }

    // Update user profile
    const updateData: Record<string, unknown> = {
      full_name: full_name.trim(),
    };
    if (role) updateData.role = role;

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: updateError.message } },
        { status: 500 },
      );
    }

    // Update store assignments if provided
    if (store_ids && Array.isArray(store_ids)) {
      // Remove existing assignments
      await supabase.from('user_stores').delete().eq('user_id', id);

      // Insert new assignments
      if (store_ids.length > 0) {
        const storeInserts = store_ids.map((sid: string) => ({
          user_id: id,
          store_id: sid,
        }));
        await supabase.from('user_stores').insert(storeInserts);
      }
    }

    // Fetch updated user
    const { data: updatedUser } = await supabase
      .from('users')
      .select(
        `
        id,
        email,
        full_name,
        role,
        is_active,
        user_stores ( store_id, stores ( id, name, code ) )
      `,
      )
      .eq('id', id)
      .single();

    return NextResponse.json({ data: updatedUser });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
