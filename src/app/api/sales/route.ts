/**
 * API route for sales history.
 *
 * GET /api/sales — List sales with filters and pagination.
 * Supports filtering by store_id, seller_id, status, date range.
 *
 * Validates: Requirements 6.9
 */

import { NextResponse } from 'next/server';

import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.max(
      1,
      Math.min(100, Number.parseInt(searchParams.get('page_size') ?? String(DEFAULT_PAGE_SIZE), 10)),
    );
    const storeId = searchParams.get('store_id') ?? null;
    const sellerId = searchParams.get('seller_id') ?? null;
    const status = searchParams.get('status') ?? null;
    const dateFrom = searchParams.get('date_from') ?? null;
    const dateTo = searchParams.get('date_to') ?? null;

    const offset = (page - 1) * pageSize;

    // Build query — sales with store and seller info
    let query = supabase
      .from('sales')
      .select(
        `
        id,
        ticket_number,
        store_id,
        seller_id,
        subtotal,
        discount_amount,
        discount_type,
        discount_value,
        tax_amount,
        total,
        status,
        voided_by,
        voided_at,
        void_reason,
        created_at,
        stores ( id, name, code ),
        users!sales_seller_id_fkey ( id, full_name )
      `,
        { count: 'exact' },
      );

    // Apply filters
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    if (sellerId) {
      query = query.eq('seller_id', sellerId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      // Add end-of-day to include the full day
      const endDate = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`;
      query = query.lte('created_at', endDate);
    }

    // Order by most recent first
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data: sales, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Transform results to include seller name at top level
    const data = (sales ?? []).map((sale: Record<string, unknown>) => {
      const store = sale.stores as { id: string; name: string; code: string } | null;
      const seller = sale.users as { id: string; full_name: string } | null;

      return {
        id: sale.id,
        ticket_number: sale.ticket_number,
        store_id: sale.store_id,
        seller_id: sale.seller_id,
        subtotal: sale.subtotal,
        discount_amount: sale.discount_amount,
        discount_type: sale.discount_type,
        discount_value: sale.discount_value,
        tax_amount: sale.tax_amount,
        total: sale.total,
        status: sale.status,
        voided_by: sale.voided_by,
        voided_at: sale.voided_at,
        void_reason: sale.void_reason,
        created_at: sale.created_at,
        store: store ? { id: store.id, name: store.name, code: store.code } : null,
        seller: seller ? { id: seller.id, full_name: seller.full_name } : null,
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
