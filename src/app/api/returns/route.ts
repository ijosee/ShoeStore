/**
 * API route for listing returns.
 *
 * GET /api/returns — List returns with filters and pagination.
 * Supports filtering by store_id, date range.
 * Joins with sales for original ticket info.
 *
 * Validates: Requirements 9.1, 9.2
 */

import { NextResponse } from 'next/server';

import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // ── 1. Verify authentication ──────────────────────────────────────────
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

    // ── 2. Parse query params ─────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.max(
      1,
      Math.min(100, Number.parseInt(searchParams.get('page_size') ?? String(DEFAULT_PAGE_SIZE), 10)),
    );
    const storeId = searchParams.get('store_id') ?? null;
    const dateFrom = searchParams.get('date_from') ?? null;
    const dateTo = searchParams.get('date_to') ?? null;

    const offset = (page - 1) * pageSize;

    // ── 3. Build query — returns with original sale and processor info ────
    let query = supabase
      .from('returns')
      .select(
        `
        id,
        return_number,
        original_sale_id,
        store_id,
        processed_by,
        approved_by,
        reason,
        reason_note,
        refund_amount,
        status,
        created_at,
        stores ( id, name, code ),
        sales!returns_original_sale_id_fkey ( id, ticket_number ),
        users!returns_processed_by_fkey ( id, full_name )
      `,
        { count: 'exact' },
      );

    // ── 4. Apply filters ──────────────────────────────────────────────────
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      const endDate = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`;
      query = query.lte('created_at', endDate);
    }

    // Order by most recent first
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data: returns, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // ── 5. Transform results ──────────────────────────────────────────────
    const data = (returns ?? []).map((ret: Record<string, unknown>) => {
      const store = ret.stores as { id: string; name: string; code: string } | null;
      const sale = ret.sales as { id: string; ticket_number: string } | null;
      const processor = ret.users as { id: string; full_name: string } | null;

      return {
        id: ret.id,
        return_number: ret.return_number,
        original_sale_id: ret.original_sale_id,
        original_ticket_number: sale?.ticket_number ?? null,
        store_id: ret.store_id,
        store: store ? { id: store.id, name: store.name, code: store.code } : null,
        processed_by: ret.processed_by,
        processor: processor ? { id: processor.id, full_name: processor.full_name } : null,
        approved_by: ret.approved_by,
        reason: ret.reason,
        reason_note: ret.reason_note,
        refund_amount: ret.refund_amount,
        status: ret.status,
        created_at: ret.created_at,
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
