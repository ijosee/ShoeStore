/**
 * API routes for user management.
 *
 * GET  /api/users — List users with filters (Admin only)
 * POST /api/users — Create a user via Supabase Admin API (Admin only)
 *
 * Validates: Requirements 11.5, 11.7
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

import { hasPermission } from '@/lib/auth/permissions';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

// ─── Admin Supabase client (uses service role key) ───────────────────────────

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function verifyAdminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
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

  if (!userProfile || !hasPermission(userProfile.role as UserRole, 'user.manage')) {
    return {
      error: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para gestionar usuarios' } },
        { status: 403 },
      ),
    };
  }

  return { user };
}

// ─── GET /api/users ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await verifyAdminUser(supabase);
    if ('error' in auth && auth.error) return auth.error;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.max(
      1,
      Math.min(100, Number.parseInt(searchParams.get('page_size') ?? String(DEFAULT_PAGE_SIZE), 10)),
    );
    const roleFilter = searchParams.get('role') ?? null;
    const storeIdFilter = searchParams.get('store_id') ?? null;
    const isActiveFilter = searchParams.get('is_active') ?? null;
    const search = searchParams.get('search')?.trim() ?? null;

    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabase
      .from('users')
      .select(
        `
        id,
        email,
        full_name,
        role,
        is_active,
        last_login_at,
        created_at,
        user_stores ( store_id, stores ( id, name, code ) )
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });

    if (roleFilter) query = query.eq('role', roleFilter);
    if (isActiveFilter !== null) query = query.eq('is_active', isActiveFilter === 'true');
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data: users, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    // If filtering by store, do it in-app since it's a nested relation
    let filteredUsers = (users ?? []) as Array<Record<string, unknown>>;
    if (storeIdFilter) {
      filteredUsers = filteredUsers.filter((u) => {
        const userStores = u.user_stores as Array<{ store_id: string }> | null;
        return userStores?.some((us) => us.store_id === storeIdFilter) ?? false;
      });
    }

    // Transform response
    const data = filteredUsers.map((u) => {
      const userStores = u.user_stores as Array<{
        store_id: string;
        stores: { id: string; name: string; code: string } | null;
      }> | null;

      return {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        is_active: u.is_active,
        last_login_at: u.last_login_at,
        created_at: u.created_at,
        stores: (userStores ?? [])
          .filter((us) => us.stores)
          .map((us) => ({
            id: us.stores!.id,
            name: us.stores!.name,
            code: us.stores!.code,
          })),
      };
    });

    const totalCount = storeIdFilter ? data.length : (count ?? 0);
    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      data,
      pagination: {
        page,
        page_size: pageSize,
        total_count: totalCount,
        total_pages: totalPages,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}

// ─── POST /api/users ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await verifyAdminUser(supabase);
    if ('error' in auth && auth.error) return auth.error;

    const body = await request.json();
    const { email, password, full_name, role, store_ids } = body;

    // Validate required fields
    if (!email?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Email requerido' } },
        { status: 400 },
      );
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Contraseña requerida (mínimo 8 caracteres)' } },
        { status: 400 },
      );
    }
    if (!full_name?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Nombre completo requerido' } },
        { status: 400 },
      );
    }
    if (!role || !['admin', 'manager', 'seller'].includes(role)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Rol inválido' } },
        { status: 400 },
      );
    }
    if (!store_ids || !Array.isArray(store_ids) || store_ids.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Debe asignar al menos una tienda' } },
        { status: 400 },
      );
    }

    // Create auth user via Supabase Admin API
    const adminSupabase = getAdminSupabase();
    const { data: authData, error: authCreateError } =
      await adminSupabase.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
      });

    if (authCreateError) {
      return NextResponse.json(
        { error: { code: 'CREATE_ERROR', message: authCreateError.message } },
        { status: 500 },
      );
    }

    const userId = authData.user.id;

    // Create user profile in users table
    const { error: profileError } = await supabase.from('users').insert({
      id: userId,
      email: email.trim(),
      full_name: full_name.trim(),
      role,
      is_active: true,
    });

    if (profileError) {
      // Cleanup: delete auth user if profile creation fails
      await adminSupabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: { code: 'CREATE_ERROR', message: profileError.message } },
        { status: 500 },
      );
    }

    // Assign stores
    const storeInserts = (store_ids as string[]).map((sid: string) => ({
      user_id: userId,
      store_id: sid,
    }));

    const { error: storeError } = await supabase
      .from('user_stores')
      .insert(storeInserts);

    if (storeError) {
      // Non-critical: user is created but store assignment failed
      return NextResponse.json(
        {
          data: { id: userId, email: email.trim(), full_name: full_name.trim(), role },
          warning: `Usuario creado pero error al asignar tiendas: ${storeError.message}`,
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      {
        data: {
          id: userId,
          email: email.trim(),
          full_name: full_name.trim(),
          role,
          store_ids,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
