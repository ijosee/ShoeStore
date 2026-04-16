/**
 * API route for stock transfers between stores.
 *
 * POST /api/inventory/transfer — Create and execute a stock transfer
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { transferSchema } from '@/lib/validators/inventory';
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
        { status: 401 }
      );
    }

    // Get user role and check permission (manager/admin only)
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'transfer.create')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para crear transferencias' } },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de transferencia inválidos',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Call the PL/pgSQL function execute_transfer
    const { data: result, error: rpcError } = await supabase.rpc('execute_transfer', {
      transfer_data: {
        source_store_id: input.source_store_id,
        destination_store_id: input.destination_store_id,
        lines: input.lines,
        note: input.note ?? null,
        created_by: user.id,
      },
    });

    if (rpcError) {
      // Check for stock insufficient errors from the PL/pgSQL function
      const isStockError =
        rpcError.message.includes('stock') || rpcError.message.includes('insuficiente');

      return NextResponse.json(
        {
          error: {
            code: isStockError ? 'STOCK_INSUFFICIENT' : 'TRANSFER_ERROR',
            message: rpcError.message,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
}
