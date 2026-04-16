/**
 * API routes for product listing and creation.
 *
 * GET  /api/products — List products with filters and pagination
 * POST /api/products — Create a product with variants and initial stock (Admin only)
 *
 * Validates: Requirements 1.1, 1.2, 1.6, 1.8, 1.10
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { generateSKU } from '@/lib/utils/sku';
import { createProductSchema } from '@/lib/validators/product';
import type { UserRole } from '@/types/database';

// ─── GET /api/products ───────────────────────────────────────────────────────

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
    const search = searchParams.get('search')?.trim() ?? null;
    const categoryId = searchParams.get('category_id') ?? null;
    const brandId = searchParams.get('brand_id') ?? null;
    const isActiveParam = searchParams.get('is_active');

    const offset = (page - 1) * pageSize;

    // Build query for products with brand/category names, primary image, variant count, total stock
    let query = supabase
      .from('products')
      .select(
        `
        id,
        name,
        base_price,
        cost,
        tax_rate,
        is_active,
        created_at,
        brands!inner ( id, name ),
        categories!inner ( id, name ),
        product_images ( image_url, thumbnail_url ),
        product_variants ( id, stock_levels ( quantity ) )
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%`);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }
    if (isActiveParam !== null) {
      query = query.eq('is_active', isActiveParam === 'true');
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Filter primary images
    query = query.eq('product_images.is_primary', true);

    const { data: products, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    // Transform response
    const data = (products ?? []).map((product: Record<string, unknown>) => {
      const brand = product.brands as { id: string; name: string } | null;
      const category = product.categories as { id: string; name: string } | null;
      const images = product.product_images as Array<{
        image_url: string;
        thumbnail_url: string | null;
      }>;
      const variants = product.product_variants as Array<{
        id: string;
        stock_levels: Array<{ quantity: number }>;
      }>;

      const primaryImage = images?.[0] ?? null;
      const variantCount = variants?.length ?? 0;
      const totalStock = variants?.reduce(
        (sum, v) =>
          sum + (v.stock_levels?.reduce((s, sl) => s + (sl.quantity ?? 0), 0) ?? 0),
        0
      ) ?? 0;

      return {
        id: product.id,
        name: product.name,
        brand: brand ? { id: brand.id, name: brand.name } : null,
        category: category ? { id: category.id, name: category.name } : null,
        base_price: product.base_price,
        cost: product.cost,
        tax_rate: product.tax_rate,
        is_active: product.is_active,
        primary_image_url: primaryImage?.thumbnail_url ?? primaryImage?.image_url ?? null,
        variant_count: variantCount,
        total_stock: totalStock,
        created_at: product.created_at,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface VariantInput {
  size_id: string;
  color_id: string;
  barcode?: string;
  price_override?: number;
}

/** Generate SKUs for all variants, returning null + error response if a size/color is missing. */
function buildVariantSKUs(
  variants: VariantInput[],
  categoryName: string,
  brandName: string,
  sizeMap: Map<string, string>,
  colorMap: Map<string, string>,
): { skus: string[] } | { error: NextResponse } {
  const skus: string[] = [];
  for (const variant of variants) {
    const sizeName = sizeMap.get(variant.size_id);
    const colorName = colorMap.get(variant.color_id);

    if (!sizeName || !colorName) {
      return {
        error: NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Talla o color no encontrado para variante' } },
          { status: 400 },
        ),
      };
    }

    skus.push(generateSKU(categoryName, brandName, sizeName, colorName));
  }
  return { skus };
}

/** Build initial stock level inserts from raw body data. */
function buildStockInserts(
  initialStock: Array<{ variant_index: number; store_id: string; quantity: number }>,
  createdVariants: Array<{ id: string }>,
) {
  return initialStock
    .filter(
      (s) =>
        s.variant_index >= 0 &&
        s.variant_index < createdVariants.length &&
        s.quantity > 0,
    )
    .map((s) => ({
      variant_id: createdVariants[s.variant_index].id,
      store_id: s.store_id,
      quantity: s.quantity,
      low_stock_threshold: 5,
    }));
}

// ─── POST /api/products ──────────────────────────────────────────────────────

export async function POST(request: Request) {
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

    // Get user role and check permission
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'product.create')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para crear productos' } },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    console.log('[POST /api/products] body:', JSON.stringify(body, null, 2));
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      console.log('[POST /api/products] validation errors:', JSON.stringify(parsed.error.issues, null, 2));
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de producto inválidos',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Fetch category and brand names for SKU generation
    const [categoryResult, brandResult] = await Promise.all([
      supabase.from('categories').select('name').eq('id', input.category_id).single(),
      supabase.from('brands').select('name').eq('id', input.brand_id).single(),
    ]);

    if (!categoryResult.data || !brandResult.data) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Categoría o marca no encontrada' } },
        { status: 400 }
      );
    }

    const categoryName = categoryResult.data.name as string;
    const brandName = brandResult.data.name as string;

    // Fetch size and color names for each variant
    const sizeIds = [...new Set(input.variants.map((v) => v.size_id))];
    const colorIds = [...new Set(input.variants.map((v) => v.color_id))];

    const [sizesResult, colorsResult] = await Promise.all([
      supabase.from('sizes').select('id, value').in('id', sizeIds),
      supabase.from('colors').select('id, name').in('id', colorIds),
    ]);

    const sizeMap = new Map(
      (sizesResult.data ?? []).map((s: { id: string; value: string }) => [s.id, s.value])
    );
    const colorMap = new Map(
      (colorsResult.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name])
    );

    // Generate SKUs for each variant
    const skuResult = buildVariantSKUs(input.variants, categoryName, brandName, sizeMap, colorMap);
    if ('error' in skuResult) return skuResult.error;
    const { skus } = skuResult;

    // Check for duplicate SKUs in the database
    const { data: existingVariants } = await supabase
      .from('product_variants')
      .select('sku, product_id, products ( name )')
      .in('sku', skus);

    if (existingVariants && existingVariants.length > 0) {
      const raw = existingVariants[0] as {
        sku: string;
        product_id: string;
        products: Array<{ name: string }> | null;
      };
      const existingProductName = raw.products?.[0]?.name ?? 'desconocido';
      return NextResponse.json(
        {
          error: {
            code: 'SKU_DUPLICATE',
            message: `El SKU ${raw.sku} ya existe para el producto '${existingProductName}'`,
            details: {
              sku: raw.sku,
              existing_product_id: raw.product_id,
              existing_product_name: existingProductName,
            },
          },
        },
        { status: 409 }
      );
    }

    // Create product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        name: input.name,
        brand_id: input.brand_id,
        category_id: input.category_id,
        description: input.description ?? null,
        base_price: input.base_price,
        cost: input.cost,
        tax_rate: input.tax_rate,
        is_active: true,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: { code: 'CREATE_ERROR', message: productError?.message ?? 'Error al crear producto' } },
        { status: 500 }
      );
    }

    const productId = product.id as string;

    // Create variants
    const variantInserts = input.variants.map((variant, index) => ({
      product_id: productId,
      size_id: variant.size_id,
      color_id: variant.color_id,
      sku: skus[index],
      barcode: variant.barcode ?? null,
      price_override: variant.price_override ?? null,
      is_active: true,
    }));

    const { data: createdVariants, error: variantsError } = await supabase
      .from('product_variants')
      .insert(variantInserts)
      .select('id, sku, size_id, color_id, barcode, price_override');

    if (variantsError || !createdVariants) {
      // Cleanup: delete the product if variants fail
      await supabase.from('products').delete().eq('id', productId);
      return NextResponse.json(
        { error: { code: 'CREATE_ERROR', message: variantsError?.message ?? 'Error al crear variantes' } },
        { status: 500 }
      );
    }

    // Create initial stock levels if provided
    if (body.initial_stock && Array.isArray(body.initial_stock)) {
      const stockInserts = buildStockInserts(
        body.initial_stock,
        createdVariants as Array<{ id: string }>,
      );
      if (stockInserts.length > 0) {
        await supabase.from('stock_levels').insert(stockInserts);
      }
    }

    // Build response with variant details
    const responseVariants = createdVariants.map(
      (v: {
        id: string;
        sku: string;
        size_id: string;
        color_id: string;
        barcode: string | null;
        price_override: number | null;
      }) => ({
        id: v.id,
        sku: v.sku,
        size: sizeMap.get(v.size_id) ?? v.size_id,
        color: colorMap.get(v.color_id) ?? v.color_id,
        barcode: v.barcode,
        price_override: v.price_override,
      })
    );

    return NextResponse.json(
      {
        data: {
          id: productId,
          name: input.name,
          variants: responseVariants,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
}
