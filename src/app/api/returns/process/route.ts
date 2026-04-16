/**
 * API route for processing a return.
 *
 * POST /api/returns/process — Process a return via PL/pgSQL `process_return`.
 * Validates JWT + permissions, validates input with Zod, checks original sale
 * exists and is not voided, enforces manager approval for sales > 30 days old,
 * then calls the atomic database function.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6
 */

import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import { RETURN_WINDOW_DAYS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { processReturnSchema } from '@/lib/validators/return';
import type { UserRole } from '@/types/database';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // ── 1. Verify authentication ──────────────────────────────────────────
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

    // ── 2. Get user profile and check return.process permission ───────────
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'return.process')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para procesar devoluciones' } },
        { status: 403 },
      );
    }

    // ── 3. Parse and validate body ────────────────────────────────────────
    const body = await request.json();
    const parsed = processReturnSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de devolución inválidos',
            details: parsed.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const input = parsed.data;

    // ── 4. Validate original sale exists and is not voided ────────────────
    const { data: originalSale, error: saleError } = await supabase
      .from('sales')
      .select('id, status, ticket_number, created_at')
      .eq('id', input.original_sale_id)
      .single();

    if (saleError || !originalSale) {
      if (saleError?.code === 'PGRST116') {
        return NextResponse.json(
          { error: { code: 'SALE_NOT_FOUND', message: 'Venta original no encontrada' } },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: saleError?.message ?? 'Error al buscar venta' } },
        { status: 500 },
      );
    }

    if (originalSale.status === 'voided') {
      return NextResponse.json(
        {
          error: {
            code: 'SALE_ALREADY_VOIDED',
            message: `La venta ${originalSale.ticket_number} ya fue anulada`,
          },
        },
        { status: 409 },
      );
    }

    // ── 5. Validate sale lines belong to the original sale ────────────────
    const saleLineIds = input.lines.map((l) => l.sale_line_id);

    const { data: saleLines, error: linesError } = await supabase
      .from('sale_lines')
      .select('id, variant_id, quantity')
      .eq('sale_id', input.original_sale_id)
      .in('id', saleLineIds);

    if (linesError) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: linesError.message } },
        { status: 500 },
      );
    }

    // Check all requested sale_line_ids exist in the original sale
    const foundLineIds = new Set((saleLines ?? []).map((sl: { id: string }) => sl.id));
    const missingLines = saleLineIds.filter((id) => !foundLineIds.has(id));

    if (missingLines.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'SALE_LINE_NOT_FOUND',
            message: `Líneas de venta no encontradas en la venta original: ${missingLines.join(', ')}`,
            details: { missing_line_ids: missingLines },
          },
        },
        { status: 400 },
      );
    }

    // ── 6. Validate return quantities don't exceed sold quantities ────────
    const saleLinesMap = new Map(
      (saleLines ?? []).map((sl: { id: string; variant_id: string; quantity: number }) => [
        sl.id,
        sl,
      ]),
    );

    // Also check for previously returned quantities
    const { data: existingReturnLines, error: existingReturnError } = await supabase
      .from('return_lines')
      .select('sale_line_id, quantity')
      .in('sale_line_id', saleLineIds);

    if (existingReturnError) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: existingReturnError.message } },
        { status: 500 },
      );
    }

    // Sum previously returned quantities per sale_line_id
    const previouslyReturned = new Map<string, number>();
    for (const rl of existingReturnLines ?? []) {
      const prev = previouslyReturned.get(rl.sale_line_id) ?? 0;
      previouslyReturned.set(rl.sale_line_id, prev + rl.quantity);
    }

    for (const line of input.lines) {
      const saleLine = saleLinesMap.get(line.sale_line_id) as
        | { id: string; variant_id: string; quantity: number }
        | undefined;

      if (!saleLine) continue;

      // Validate variant_id matches
      if (saleLine.variant_id !== line.variant_id) {
        return NextResponse.json(
          {
            error: {
              code: 'VARIANT_MISMATCH',
              message: `La variante ${line.variant_id} no corresponde a la línea de venta ${line.sale_line_id}`,
            },
          },
          { status: 400 },
        );
      }

      // Check quantity including previously returned
      const alreadyReturned = previouslyReturned.get(line.sale_line_id) ?? 0;
      const availableToReturn = saleLine.quantity - alreadyReturned;

      if (line.quantity > availableToReturn) {
        return NextResponse.json(
          {
            error: {
              code: 'RETURN_EXCEEDS_QUANTITY',
              message: `No se puede devolver ${line.quantity} unidades de la línea ${line.sale_line_id}, solo quedan ${availableToReturn} disponibles para devolución`,
              details: {
                sale_line_id: line.sale_line_id,
                requested: line.quantity,
                available: availableToReturn,
                already_returned: alreadyReturned,
              },
            },
          },
          { status: 400 },
        );
      }
    }

    // ── 7. Check if sale is older than RETURN_WINDOW_DAYS ─────────────────
    const saleDate = new Date(originalSale.created_at);
    const now = new Date();
    const daysSinceSale = Math.floor(
      (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceSale > RETURN_WINDOW_DAYS) {
      // Requires manager/admin approval — check sale.void permission as proxy
      if (!hasPermission(userProfile.role as UserRole, 'sale.void')) {
        return NextResponse.json(
          {
            error: {
              code: 'RETURN_REQUIRES_APPROVAL',
              message: `La venta tiene más de ${RETURN_WINDOW_DAYS} días. Se requiere aprobación de Gerente o Admin.`,
              details: {
                sale_date: originalSale.created_at,
                days_since_sale: daysSinceSale,
                return_window_days: RETURN_WINDOW_DAYS,
              },
            },
          },
          { status: 403 },
        );
      }
    }

    // ── 8. Call PL/pgSQL function process_return ──────────────────────────
    const { data: result, error: rpcError } = await supabase.rpc('process_return', {
      return_data: {
        original_sale_id: input.original_sale_id,
        store_id: input.store_id,
        processed_by: user.id,
        reason: input.reason,
        reason_note: input.reason_note ?? null,
        lines: input.lines,
      },
    });

    if (rpcError) {
      const msg = rpcError.message;

      // Parse structured errors from PL/pgSQL
      if (msg.includes('SALE_NOT_FOUND')) {
        return NextResponse.json(
          { error: { code: 'SALE_NOT_FOUND', message: 'Venta original no encontrada' } },
          { status: 404 },
        );
      }

      if (msg.includes('SALE_ALREADY_VOIDED')) {
        return NextResponse.json(
          {
            error: {
              code: 'SALE_ALREADY_VOIDED',
              message: msg.split(':').slice(1).join(':').trim() || 'La venta ya fue anulada',
            },
          },
          { status: 409 },
        );
      }

      if (msg.includes('SALE_LINE_NOT_FOUND')) {
        return NextResponse.json(
          {
            error: {
              code: 'SALE_LINE_NOT_FOUND',
              message: msg.split(':').slice(1).join(':').trim() || 'Línea de venta no encontrada',
            },
          },
          { status: 400 },
        );
      }

      if (msg.includes('RETURN_EXCEEDS_QUANTITY')) {
        return NextResponse.json(
          {
            error: {
              code: 'RETURN_EXCEEDS_QUANTITY',
              message:
                msg.split(':').slice(1).join(':').trim() ||
                'La cantidad a devolver excede lo vendido',
            },
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error: {
            code: 'RETURN_ERROR',
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
