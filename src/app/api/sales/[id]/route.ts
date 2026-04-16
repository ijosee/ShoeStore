/**
 * API route for sale detail.
 *
 * GET /api/sales/[id] — Full sale detail with lines, payments, store, and seller info.
 *
 * Validates: Requirements 6.9
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
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
        { status: 401 },
      );
    }

    // Fetch sale with all related data
    const { data: sale, error } = await supabase
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
        stores ( id, name, code, address, phone ),
        users!sales_seller_id_fkey ( id, full_name, email ),
        sale_lines (
          id,
          variant_id,
          product_name,
          variant_description,
          quantity,
          unit_price,
          line_discount,
          tax_rate,
          line_subtotal,
          line_tax,
          line_total
        ),
        sale_payments (
          id,
          payment_method_id,
          amount,
          amount_received,
          change_amount,
          payment_methods ( id, name, icon )
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error || !sale) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Venta no encontrada' } },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error?.message ?? 'Error al obtener venta' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: sale });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
