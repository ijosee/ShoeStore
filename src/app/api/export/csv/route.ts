/**
 * API route for CSV export.
 *
 * GET /api/export/csv — Export data as CSV file
 * Accepts type (stock_current, catalog, movements) and filters via query params.
 * Generates CSV with UTF-8 BOM and comma separator, header row.
 * Limits to 50,000 records per file.
 *
 * Validates: Requirements 5.1, 5.2, 5.3
 */

import { NextResponse } from 'next/server';

import { MAX_EXPORT_ROWS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

// ─── CSV Helpers ─────────────────────────────────────────────────────────────

/** UTF-8 BOM to ensure Excel opens the file correctly. */
const UTF8_BOM = '\uFEFF';

/** Escape a CSV field value (wrap in quotes if it contains comma, quote, or newline). */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV string from headers and rows. */
function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(','));
  return UTF8_BOM + [headerLine, ...dataLines].join('\r\n');
}

/** Create a CSV Response with proper headers. */
function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ─── Export: Stock Current ───────────────────────────────────────────────────

async function exportStockCurrent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string | null,
  categoryId: string | null,
) {
  let query = supabase
    .from('stock_levels')
    .select(
      `
      quantity,
      low_stock_threshold,
      product_variants!inner (
        sku,
        barcode,
        price_override,
        sizes ( value ),
        colors ( name ),
        products!inner (
          name,
          base_price,
          brands ( name ),
          categories ( name )
        )
      ),
      stores ( name, code )
    `,
    )
    .limit(MAX_EXPORT_ROWS);

  if (storeId) query = query.eq('store_id', storeId);
  if (categoryId) query = query.eq('product_variants.products.category_id', categoryId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const headers = [
    'Tienda',
    'Código Tienda',
    'Producto',
    'Marca',
    'Categoría',
    'SKU',
    'Código de Barras',
    'Talla',
    'Color',
    'Precio',
    'Cantidad',
    'Umbral Bajo',
    'Estado',
  ];

  const rows = (data ?? []).map((sl: Record<string, unknown>) => {
    const variant = sl.product_variants as Record<string, unknown> | null;
    const product = variant?.products as Record<string, unknown> | null;
    const store = sl.stores as { name: string; code: string } | null;
    const size = variant?.sizes as { value: string } | null;
    const color = variant?.colors as { name: string } | null;
    const brand = product?.brands as { name: string } | null;
    const category = product?.categories as { name: string } | null;

    const qty = sl.quantity as number;
    const threshold = sl.low_stock_threshold as number;
    let status = 'Normal';
    if (qty === 0) status = 'Agotado';
    else if (qty <= threshold) status = 'Bajo';

    const price = (variant?.price_override as number | null) ?? (product?.base_price as number) ?? 0;

    return [
      store?.name ?? '',
      store?.code ?? '',
      (product?.name as string) ?? '',
      brand?.name ?? '',
      category?.name ?? '',
      (variant?.sku as string) ?? '',
      (variant?.barcode as string) ?? '',
      size?.value ?? '',
      color?.name ?? '',
      price.toFixed(2),
      String(qty),
      String(threshold),
      status,
    ];
  });

  return { headers, rows };
}

// ─── Export: Catalog ─────────────────────────────────────────────────────────

async function exportCatalog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string | null,
  brandId: string | null,
) {
  let query = supabase
    .from('products')
    .select(
      `
      name,
      base_price,
      cost,
      tax_rate,
      is_active,
      created_at,
      brands ( name ),
      categories ( name ),
      product_variants (
        sku,
        barcode,
        price_override,
        is_active,
        sizes ( value ),
        colors ( name )
      )
    `,
    )
    .limit(MAX_EXPORT_ROWS);

  if (categoryId) query = query.eq('category_id', categoryId);
  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const headers = [
    'Producto',
    'Marca',
    'Categoría',
    'Precio Base',
    'Costo',
    'Tasa IVA',
    'Activo',
    'SKU',
    'Código de Barras',
    'Talla',
    'Color',
    'Precio Variante',
    'Variante Activa',
  ];

  const rows: string[][] = [];
  for (const product of (data ?? []) as Record<string, unknown>[]) {
    const brand = product.brands as { name: string } | null;
    const category = product.categories as { name: string } | null;
    const variants = product.product_variants as Array<Record<string, unknown>> | null;

    if (!variants || variants.length === 0) {
      rows.push([
        (product.name as string) ?? '',
        brand?.name ?? '',
        category?.name ?? '',
        ((product.base_price as number) ?? 0).toFixed(2),
        ((product.cost as number) ?? 0).toFixed(2),
        ((product.tax_rate as number) ?? 0).toFixed(2),
        product.is_active ? 'Sí' : 'No',
        '', '', '', '', '', '',
      ]);
    } else {
      for (const v of variants) {
        const size = v.sizes as { value: string } | null;
        const color = v.colors as { name: string } | null;
        const variantPrice = (v.price_override as number | null) ?? (product.base_price as number);
        rows.push([
          (product.name as string) ?? '',
          brand?.name ?? '',
          category?.name ?? '',
          ((product.base_price as number) ?? 0).toFixed(2),
          ((product.cost as number) ?? 0).toFixed(2),
          ((product.tax_rate as number) ?? 0).toFixed(2),
          product.is_active ? 'Sí' : 'No',
          (v.sku as string) ?? '',
          (v.barcode as string) ?? '',
          size?.value ?? '',
          color?.name ?? '',
          variantPrice.toFixed(2),
          v.is_active ? 'Sí' : 'No',
        ]);
      }
    }

    if (rows.length >= MAX_EXPORT_ROWS) break;
  }

  return { headers, rows: rows.slice(0, MAX_EXPORT_ROWS) };
}

// ─── Export: Movements ───────────────────────────────────────────────────────

async function exportMovements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
) {
  let query = supabase
    .from('stock_movements')
    .select(
      `
      movement_type,
      quantity,
      stock_before,
      stock_after,
      reference_type,
      note,
      created_at,
      product_variants!inner (
        sku,
        products!inner ( name )
      ),
      stores ( name, code ),
      users ( full_name )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(MAX_EXPORT_ROWS);

  if (storeId) query = query.eq('store_id', storeId);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const MOVEMENT_LABELS: Record<string, string> = {
    entry: 'Entrada',
    sale: 'Venta',
    return: 'Devolución',
    adjustment: 'Ajuste',
    transfer_out: 'Salida por transferencia',
    transfer_in: 'Entrada por transferencia',
  };

  const headers = [
    'Fecha',
    'Tienda',
    'Producto',
    'SKU',
    'Tipo Movimiento',
    'Cantidad',
    'Stock Antes',
    'Stock Después',
    'Referencia',
    'Nota',
    'Usuario',
  ];

  const rows = (data ?? []).map((m: Record<string, unknown>) => {
    const variant = m.product_variants as Record<string, unknown> | null;
    const product = variant?.products as { name: string } | null;
    const store = m.stores as { name: string; code: string } | null;
    const user = m.users as { full_name: string } | null;

    return [
      (m.created_at as string) ?? '',
      store?.name ?? '',
      product?.name ?? '',
      (variant?.sku as string) ?? '',
      MOVEMENT_LABELS[m.movement_type as string] ?? (m.movement_type as string),
      String(m.quantity ?? 0),
      String(m.stock_before ?? 0),
      String(m.stock_after ?? 0),
      (m.reference_type as string) ?? '',
      (m.note as string) ?? '',
      user?.full_name ?? '',
    ];
  });

  return { headers, rows };
}

// ─── GET /api/export/csv ─────────────────────────────────────────────────────

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
    const type = searchParams.get('type');
    const storeId = searchParams.get('store_id') ?? null;
    const categoryId = searchParams.get('category_id') ?? null;
    const brandId = searchParams.get('brand_id') ?? null;
    const dateFrom = searchParams.get('date_from') ?? null;
    const dateTo = searchParams.get('date_to') ?? null;

    if (!type || !['stock_current', 'catalog', 'movements'].includes(type)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Tipo de exportación inválido. Valores permitidos: stock_current, catalog, movements',
          },
        },
        { status: 400 },
      );
    }

    let headers: string[];
    let rows: string[][];
    let filename: string;

    const dateStr = new Date().toISOString().slice(0, 10);

    switch (type) {
      case 'stock_current': {
        const result = await exportStockCurrent(supabase, storeId, categoryId);
        headers = result.headers;
        rows = result.rows;
        filename = `stock_actual_${dateStr}.csv`;
        break;
      }
      case 'catalog': {
        const result = await exportCatalog(supabase, categoryId, brandId);
        headers = result.headers;
        rows = result.rows;
        filename = `catalogo_${dateStr}.csv`;
        break;
      }
      case 'movements': {
        const result = await exportMovements(supabase, storeId, dateFrom, dateTo);
        headers = result.headers;
        rows = result.rows;
        filename = `movimientos_${dateStr}.csv`;
        break;
      }
      default:
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Tipo de exportación no soportado' } },
          { status: 400 },
        );
    }

    const csv = buildCsv(headers, rows);
    return csvResponse(csv, filename);
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
