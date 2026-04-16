/**
 * API route for stock movement history (kardex).
 *
 * GET /api/inventory/kardex — List stock movements with filters and pagination
 *
 * Validates: Requirements 3.4, 3.5
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

const DEFAULT_KARDEX_PAGE_SIZE = 50;

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
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.max(
      1,
      Math.min(100, Number.parseInt(searchParams.get('page_size') ?? String(DEFAULT_KARDEX_PAGE_SIZE), 10))
    );
    const variantId = searchParams.get('variant_id') ?? null;
    const storeId = searchParams.get('store_id') ?? null;
    const movementType = searchParams.get('movement_type') ?? null;
    const dateFrom = searchParams.get('date_from') ?? null;
    const dateTo = searchParams.get('date_to') ?? null;

    const offset = (page - 1) * pageSize;

    // Build query — stock_movements with variant and user info
    let query = supabase
      .from('stock_movements')
      .select(
        `
        id,
        variant_id,
        store_id,
        movement_type,
        quantity,
        stock_before,
        stock_after,
        reference_type,
        reference_id,
        note,
        user_id,
        created_at,
        product_variants (
          id,
          sku,
          sizes ( id, value ),
          colors ( id, name ),
          products ( id, name )
        ),
        users ( id, full_name, email ),
        stores ( id, name, code )
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (variantId) {
      query = query.eq('variant_id', variantId);
    }
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    if (movementType) {
      // Support comma-separated movement types (e.g., "sale,return")
      const types = movementType.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length === 1) {
        query = query.eq('movement_type', types[0]);
      } else if (types.length > 1) {
        query = query.in('movement_type', types);
      }
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      // Add end-of-day to include the full day
      const dateToEnd = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`;
      query = query.lte('created_at', dateToEnd);
    }

    // Order by created_at descending and apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data: movements, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    // Transform response
    const data = (movements ?? []).map((m: Record<string, unknown>) => {
      const variant = m.product_variants as Record<string, unknown> | null;
      const product = variant?.products as { id: string; name: string } | null;
      const size = variant?.sizes as { id: string; value: string } | null;
      const color = variant?.colors as { id: string; name: string } | null;
      const userInfo = m.users as { id: string; full_name: string; email: string } | null;
      const store = m.stores as { id: string; name: string; code: string } | null;

      return {
        id: m.id,
        variant_id: m.variant_id,
        store_id: m.store_id,
        movement_type: m.movement_type,
        quantity: m.quantity,
        stock_before: m.stock_before,
        stock_after: m.stock_after,
        reference_type: m.reference_type,
        reference_id: m.reference_id,
        note: m.note,
        user_id: m.user_id,
        created_at: m.created_at,
        variant: {
          id: variant?.id ?? null,
          sku: variant?.sku ?? null,
          size: size ? { id: size.id, value: size.value } : null,
          color: color ? { id: color.id, name: color.name } : null,
          product_name: product?.name ?? null,
        },
        user: userInfo
          ? { id: userInfo.id, full_name: userInfo.full_name, email: userInfo.email }
          : null,
        store: store ? { id: store.id, name: store.name, code: store.code } : null,
      };
    });

    const totalCount = count ?? 0;
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
      { status: 500 }
    );
  }
}
