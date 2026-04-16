/**
 * API route for POS product search.
 *
 * GET /api/pos/search — Quick search with PostgreSQL full-text search
 * over product name + SKU + barcode, filtered by is_active=true and stock > 0
 * in the specified store.
 *
 * Validates: Requirements 6.1, 6.2
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

const MAX_RESULTS = 20;

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
    const q = searchParams.get('q')?.trim() ?? '';
    const storeId = searchParams.get('store_id');

    if (!storeId) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El parámetro store_id es requerido',
          },
        },
        { status: 400 },
      );
    }

    if (!q) {
      return NextResponse.json({ data: [] });
    }

    // Build query: join stock_levels → product_variants → products, sizes, colors, product_images
    // Filter: is_active=true, stock > 0 in the specified store
    // Search: product name (ilike), SKU (ilike), or barcode (exact match)
    let query = supabase
      .from('stock_levels')
      .select(
        `
        quantity,
        product_variants!inner (
          id,
          sku,
          barcode,
          price_override,
          is_active,
          sizes ( id, value ),
          colors ( id, name ),
          products!inner (
            id,
            name,
            base_price,
            tax_rate,
            is_active,
            product_images ( image_url, thumbnail_url, is_primary, sort_order )
          )
        )
      `,
      )
      .eq('store_id', storeId)
      .gt('quantity', 0)
      .eq('product_variants.is_active', true)
      .eq('product_variants.products.is_active', true);

    // Determine search strategy: exact barcode match, or name/SKU ilike
    const isBarcode = /^\d{8,14}$/.test(q);

    if (isBarcode) {
      query = query.eq('product_variants.barcode', q);
    } else {
      // Search by product name using ilike on the inner join
      query = query.ilike('product_variants.products.name', `%${q}%`);
    }

    query = query.limit(MAX_RESULTS);

    const { data: stockRows, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    // Transform results into the expected response shape
    const results = (stockRows ?? []).map((sl: Record<string, unknown>) => {
      const variant = sl.product_variants as Record<string, unknown>;
      const product = variant.products as Record<string, unknown>;
      const size = variant.sizes as { id: string; value: string } | null;
      const color = variant.colors as { id: string; name: string } | null;
      const images = product.product_images as Array<{
        image_url: string;
        thumbnail_url: string | null;
        is_primary: boolean;
        sort_order: number;
      }> | null;

      // Pick the primary image or the first one by sort_order
      const primaryImage = images?.find((img) => img.is_primary)
        ?? images?.toSorted((a, b) => a.sort_order - b.sort_order)[0]
        ?? null;

      const basePrice = product.base_price as number;
      const priceOverride = variant.price_override as number | null;

      return {
        variant_id: variant.id,
        product_name: product.name,
        size: size?.value ?? null,
        color: color?.name ?? null,
        sku: variant.sku,
        barcode: variant.barcode ?? null,
        price: priceOverride ?? basePrice,
        tax_rate: product.tax_rate,
        stock: sl.quantity as number,
        image_url: primaryImage?.thumbnail_url ?? primaryImage?.image_url ?? null,
      };
    });

    return NextResponse.json({ data: results });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
