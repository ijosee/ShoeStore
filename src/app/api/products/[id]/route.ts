/**
 * API routes for product detail and update.
 *
 * GET /api/products/[id] — Product detail with variants, images, and stock per store
 * PUT /api/products/[id] — Update product fields (Admin only)
 *
 * Validates: Requirements 1.1, 1.2, 1.9
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { updateProductSchema } from '@/lib/validators/product';
import type { UserRole } from '@/types/database';

// ─── GET /api/products/[id] ─────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
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

    // Fetch product with all related data
    const { data: product, error } = await supabase
      .from('products')
      .select(
        `
        id,
        name,
        description,
        base_price,
        cost,
        tax_rate,
        is_active,
        created_by,
        created_at,
        updated_at,
        brands ( id, name ),
        categories ( id, name ),
        product_images ( id, color, image_url, thumbnail_url, optimized_url, sort_order, is_primary, created_at ),
        product_variants (
          id,
          sku,
          barcode,
          price_override,
          is_active,
          created_at,
          updated_at,
          sizes ( id, value, sort_order ),
          colors ( id, name, hex_code, sort_order ),
          stock_levels ( id, store_id, quantity, low_stock_threshold, stores ( id, name, code ) )
        )
      `
      )
      .eq('id', id)
      .single();

    if (error || !product) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Producto no encontrado' } },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error?.message ?? 'Error al obtener producto' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: product });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
}

// ─── PUT /api/products/[id] ─────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
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

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'product.edit')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para editar productos' } },
        { status: 403 }
      );
    }

    // Verify product exists
    const { data: existing, error: existError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Producto no encontrado' } },
        { status: 404 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
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

    // Build update object with only provided fields (excluding variants for PUT)
    const updateFields: Record<string, unknown> = {};
    if (input.name !== undefined) updateFields.name = input.name;
    if (input.brand_id !== undefined) updateFields.brand_id = input.brand_id;
    if (input.category_id !== undefined) updateFields.category_id = input.category_id;
    if (input.description !== undefined) updateFields.description = input.description;
    if (input.base_price !== undefined) updateFields.base_price = input.base_price;
    if (input.cost !== undefined) updateFields.cost = input.cost;
    if (input.tax_rate !== undefined) updateFields.tax_rate = input.tax_rate;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No se proporcionaron campos para actualizar' } },
        { status: 400 }
      );
    }

    updateFields.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update(updateFields)
      .eq('id', id)
      .select(
        `
        id,
        name,
        description,
        base_price,
        cost,
        tax_rate,
        is_active,
        created_at,
        updated_at,
        brands ( id, name ),
        categories ( id, name )
      `
      )
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: updateError?.message ?? 'Error al actualizar producto' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
}
