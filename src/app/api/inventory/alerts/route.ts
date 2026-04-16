/**
 * API route for stock alerts.
 *
 * GET /api/inventory/alerts — List active stock alerts
 *
 * Validates: Requirements 13.1, 13.3
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

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
    const storeId = searchParams.get('store_id') ?? null;

    // Build query — active alerts with variant and store info
    let query = supabase
      .from('stock_alerts')
      .select(
        `
        id,
        variant_id,
        store_id,
        current_stock,
        threshold,
        status,
        acknowledged_by,
        acknowledged_note,
        acknowledged_at,
        created_at,
        product_variants (
          id,
          sku,
          sizes ( id, value ),
          colors ( id, name ),
          products ( id, name )
        ),
        stores ( id, name, code )
      `
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    // Filter by store if provided
    if (storeId) {
      query = query.eq('store_id', storeId);
    } else {
      // If no store_id provided, filter by user's assigned stores (non-admin)
      const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userProfile && userProfile.role !== 'admin') {
        const { data: userStores } = await supabase
          .from('user_stores')
          .select('store_id')
          .eq('user_id', user.id);

        if (userStores && userStores.length > 0) {
          const storeIds = userStores.map((us: { store_id: string }) => us.store_id);
          query = query.in('store_id', storeIds);
        }
      }
    }

    const { data: alerts, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    // Transform response
    const data = (alerts ?? []).map((alert: Record<string, unknown>) => {
      const variant = alert.product_variants as Record<string, unknown> | null;
      const product = variant?.products as { id: string; name: string } | null;
      const size = variant?.sizes as { id: string; value: string } | null;
      const color = variant?.colors as { id: string; name: string } | null;
      const store = alert.stores as { id: string; name: string; code: string } | null;

      return {
        id: alert.id,
        variant_id: alert.variant_id,
        store_id: alert.store_id,
        current_stock: alert.current_stock,
        threshold: alert.threshold,
        status: alert.status,
        acknowledged_by: alert.acknowledged_by,
        acknowledged_note: alert.acknowledged_note,
        acknowledged_at: alert.acknowledged_at,
        created_at: alert.created_at,
        variant: {
          id: variant?.id ?? null,
          sku: variant?.sku ?? null,
          size: size ? { id: size.id, value: size.value } : null,
          color: color ? { id: color.id, name: color.name } : null,
          product_name: product?.name ?? null,
        },
        store: store ? { id: store.id, name: store.name, code: store.code } : null,
      };
    });

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
}
