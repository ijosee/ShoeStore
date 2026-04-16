/**
 * API route for confirming a sale.
 *
 * POST /api/sales/confirm — Confirm sale via PL/pgSQL `confirm_sale` function.
 * Validates JWT + permissions, validates input with Zod, then calls the
 * atomic database function.
 *
 * Validates: Requirements 6.9, 6.10
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { confirmSaleSchema } from '@/lib/validators/sale';
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

    // Get user role and check permission
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'sale.create')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para registrar ventas' } },
        { status: 403 },
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = confirmSaleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de venta inválidos',
            details: parsed.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const input = parsed.data;

    // Call the PL/pgSQL function confirm_sale
    const { data: result, error: rpcError } = await supabase.rpc('confirm_sale', {
      sale_data: {
        store_id: input.store_id,
        seller_id: user.id,
        lines: input.lines,
        discount: input.discount ?? null,
        payments: input.payments,
      },
    });

    if (rpcError) {
      // Detect specific error types from the PL/pgSQL function
      const msg = rpcError.message.toLowerCase();
      const isStockError = msg.includes('stock') || msg.includes('insuficiente');
      const isPaymentError = msg.includes('pago') || msg.includes('payment') || msg.includes('total');

      if (isStockError) {
        return NextResponse.json(
          {
            error: {
              code: 'STOCK_INSUFFICIENT',
              message: rpcError.message,
            },
          },
          { status: 409 },
        );
      }

      if (isPaymentError) {
        return NextResponse.json(
          {
            error: {
              code: 'PAYMENT_MISMATCH',
              message: rpcError.message,
            },
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error: {
            code: 'SALE_ERROR',
            message: rpcError.message,
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
