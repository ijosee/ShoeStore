/**
 * API route for audit log queries.
 *
 * GET /api/audit — List audit logs with filters and pagination.
 * Only Admin and Manager (filtered by store) can access.
 *
 * Validates: Requirements 12.4
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

export async function GET(request: Request) {
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

    // Get user role and check permission
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'audit.view')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para ver auditoría' } },
        { status: 403 },
      );
    }

    const role = userProfile.role as UserRole;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.max(
      1,
      Math.min(100, Number.parseInt(searchParams.get('page_size') ?? String(DEFAULT_PAGE_SIZE), 10)),
    );
    const userId = searchParams.get('user_id') ?? null;
    const actionType = searchParams.get('action_type') ?? null;
    const entityType = searchParams.get('entity_type') ?? null;
    const storeId = searchParams.get('store_id') ?? null;
    const dateFrom = searchParams.get('date_from') ?? null;
    const dateTo = searchParams.get('date_to') ?? null;

    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabase
      .from('audit_logs')
      .select(
        `
        id,
        user_id,
        action_type,
        entity_type,
        entity_id,
        store_id,
        old_values,
        new_values,
        ip_address,
        user_agent,
        created_at,
        users ( full_name, email )
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });

    // Manager can only see logs from their assigned stores
    if (role === 'manager') {
      const { data: userStores } = await supabase
        .from('user_stores')
        .select('store_id')
        .eq('user_id', user.id);

      const assignedStoreIds = (userStores ?? []).map(
        (us: { store_id: string }) => us.store_id,
      );

      if (assignedStoreIds.length > 0) {
        query = query.in('store_id', assignedStoreIds);
      } else {
        // No stores assigned — return empty
        return NextResponse.json({
          data: [],
          pagination: { page, page_size: pageSize, total_count: 0, total_pages: 0 },
        });
      }
    }

    // Apply filters
    if (userId) query = query.eq('user_id', userId);
    if (actionType) query = query.eq('action_type', actionType);
    if (entityType) query = query.eq('entity_type', entityType);
    if (storeId) query = query.eq('store_id', storeId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data: logs, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Transform response
    const data = (logs ?? []).map((log: Record<string, unknown>) => {
      const logUser = log.users as { full_name: string; email: string } | null;
      return {
        id: log.id,
        user_id: log.user_id,
        user_name: logUser?.full_name ?? null,
        user_email: logUser?.email ?? null,
        action_type: log.action_type,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        store_id: log.store_id,
        old_values: log.old_values,
        new_values: log.new_values,
        ip_address: log.ip_address,
        created_at: log.created_at,
      };
    });

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
