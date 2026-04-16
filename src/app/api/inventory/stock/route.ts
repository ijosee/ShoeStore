/**
 * API route for current stock levels.
 *
 * GET /api/inventory/stock — List stock levels with filters and pagination
 *
 * Validates: Requirements 3.1, 3.5, 13.1
 */

import { NextResponse } from 'next/server';

import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Transform a raw stock_levels row into the API response shape. */
function transformStockRow(sl: Record<string, unknown>) {
  const variant = sl.product_variants as Record<string, unknown> | null;
  const product = variant?.products as Record<string, unknown> | null;
  const size = variant?.sizes as { id: string; value: string } | null;
  const color = variant?.colors as { id: string; name: string; hex_code: string } | null;
  const brand = product?.brands as { id: string; name: string } | null;
  const category = product?.categories as { id: string; name: string } | null;
  const store = sl.stores as { id: string; name: string; code: string } | null;

  const quantity = sl.quantity as number;
  const threshold = sl.low_stock_threshold as number;
  let stockStatus: 'normal' | 'low' | 'out' = 'normal';
  if (quantity === 0) stockStatus = 'out';
  else if (quantity <= threshold) stockStatus = 'low';

  return {
    id: sl.id,
    variant_id: sl.variant_id,
    store_id: sl.store_id,
    quantity,
    low_stock_threshold: threshold,
    status: stockStatus,
    updated_at: sl.updated_at,
    variant: {
      id: variant?.id ?? null,
      sku: variant?.sku ?? null,
      barcode: variant?.barcode ?? null,
      price_override: variant?.price_override ?? null,
      is_active: variant?.is_active ?? null,
      size: size ? { id: size.id, value: size.value } : null,
      color: color ? { id: color.id, name: color.name, hex_code: color.hex_code } : null,
    },
    product: {
      id: product?.id ?? null,
      name: product?.name ?? null,
      base_price: product?.base_price ?? null,
      tax_rate: product?.tax_rate ?? null,
      brand: brand ? { id: brand.id, name: brand.name } : null,
      category: category ? { id: category.id, name: category.name } : null,
    },
    store: store ? { id: store.id, name: store.name, code: store.code } : null,
  };
}

/** Build the paginated JSON response for stock levels. */
function buildStockResponse(
  rows: Record<string, unknown>[],
  page: number,
  pageSize: number,
  totalCount: number,
  totalPages: number,
) {
  return NextResponse.json({
    data: rows.map(transformStockRow),
    pagination: {
      page,
      page_size: pageSize,
      total_count: totalCount,
      total_pages: totalPages,
    },
  });
}

// ─── GET /api/inventory/stock ────────────────────────────────────────────────

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
      Math.min(100, Number.parseInt(searchParams.get('page_size') ?? String(DEFAULT_PAGE_SIZE), 10))
    );
    const storeId = searchParams.get('store_id') ?? null;
    const categoryId = searchParams.get('category_id') ?? null;
    const brandId = searchParams.get('brand_id') ?? null;
    const status = searchParams.get('status') ?? null; // normal | low | out
    const search = searchParams.get('search')?.trim() ?? null;

    const offset = (page - 1) * pageSize;

    // Build query — stock_levels joined with variant, product, and store info
    let query = supabase
      .from('stock_levels')
      .select(
        `
        id,
        variant_id,
        store_id,
        quantity,
        low_stock_threshold,
        updated_at,
        product_variants!inner (
          id,
          sku,
          barcode,
          price_override,
          is_active,
          sizes ( id, value ),
          colors ( id, name, hex_code ),
          products!inner (
            id,
            name,
            base_price,
            tax_rate,
            is_active,
            brand_id,
            category_id,
            brands ( id, name ),
            categories ( id, name )
          )
        ),
        stores ( id, name, code )
      `,
        { count: 'exact' }
      );

    // Filter by store
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    // Filter by category (through product)
    if (categoryId) {
      query = query.eq('product_variants.products.category_id', categoryId);
    }

    // Filter by brand (through product)
    if (brandId) {
      query = query.eq('product_variants.products.brand_id', brandId);
    }

    // Filter by search (product name or SKU)
    if (search) {
      query = query.ilike('product_variants.products.name', `%${search}%`);
    }

    // Filter by stock status: 'out' can be filtered at DB level.
    // 'low' and 'normal' require column-to-column comparison (quantity vs low_stock_threshold)
    // which PostgREST doesn't support directly, so we filter those in the application layer.
    if (status === 'out') {
      query = query.eq('quantity', 0);
    }

    // Apply ordering
    query = query.order('updated_at', { ascending: false });

    // For 'low' and 'normal' status, fetch all matching records and filter in-app
    // since PostgREST can't compare two columns in the same row.
    if (status === 'low' || status === 'normal') {
      const { data: allLevels, error: allError } = await query;

      if (allError) {
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: allError.message } },
          { status: 500 }
        );
      }

      const filtered = (allLevels ?? []).filter((sl: Record<string, unknown>) => {
        const qty = sl.quantity as number;
        const threshold = sl.low_stock_threshold as number;
        if (status === 'low') return qty > 0 && qty <= threshold;
        return qty > threshold; // normal
      });

      const totalCount = filtered.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const paged = filtered.slice(offset, offset + pageSize);

      return buildStockResponse(paged, page, pageSize, totalCount, totalPages);
    }

    // For 'out' and no status filter, use DB-level pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data: stockLevels, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return buildStockResponse(
      (stockLevels ?? []) as Record<string, unknown>[],
      page,
      pageSize,
      totalCount,
      totalPages,
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
}
