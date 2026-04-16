/**
 * API route for voiding a sale.
 *
 * POST /api/sales/void — Void a completed sale (Manager/Admin only).
 * Updates sale status to 'voided' with reason, voided_by, and voided_at.
 *
 * Validates: Requirements 6.11
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { voidSaleSchema } from '@/lib/validators/sale';
import type { UserRole } from '@/types/database';

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
        { status: 401 },
      );
    }

    // Get user role and check permission (manager/admin only)
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'sale.void')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para anular ventas' } },
        { status: 403 },
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = voidSaleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de anulación inválidos',
            details: parsed.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const input = parsed.data;

    // Verify the sale exists and is not already voided
    const { data: existingSale, error: fetchError } = await supabase
      .from('sales')
      .select('id, status, ticket_number')
      .eq('id', input.sale_id)
      .single();

    if (fetchError || !existingSale) {
      if (fetchError?.code === 'PGRST116') {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Venta no encontrada' } },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: fetchError?.message ?? 'Error al buscar venta' } },
        { status: 500 },
      );
    }

    if (existingSale.status === 'voided') {
      return NextResponse.json(
        {
          error: {
            code: 'SALE_ALREADY_VOIDED',
            message: `La venta ${existingSale.ticket_number} ya fue anulada`,
          },
        },
        { status: 409 },
      );
    }

    // Update sale to voided status
    const now = new Date().toISOString();
    const { data: updatedSale, error: updateError } = await supabase
      .from('sales')
      .update({
        status: 'voided',
        voided_by: user.id,
        voided_at: now,
        void_reason: input.reason,
      })
      .eq('id', input.sale_id)
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
          change_amount
        )
      `,
      )
      .single();

    if (updateError || !updatedSale) {
      return NextResponse.json(
        {
          error: {
            code: 'VOID_ERROR',
            message: updateError?.message ?? 'Error al anular la venta',
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: updatedSale });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
