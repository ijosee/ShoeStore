'use client';

import {
  Euro,
  Package,
  AlertTriangle,
  Store,
  ShoppingCart,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  RecentSalesTable,
  type RecentSale,
} from '@/components/dashboard/RecentSalesTable';
import {
  RecentMovementsTable,
  type RecentMovement,
} from '@/components/dashboard/RecentMovementsTable';
import { QuickAccessPOS } from '@/components/dashboard/QuickAccessPOS';
import { ROLE_LABELS } from '@/lib/constants';
import { formatMXN } from '@/lib/utils/currency';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  salesTodayTotal: number;
  salesTodayCount: number;
  salesByStore: { store_name: string; total: number; count: number }[];
  activeProducts: number;
  activeAlerts: number;
  recentSales: RecentSale[];
  recentMovements: RecentMovement[];
}

async function fetchDashboardStats(
  role: string,
  storeId: string | null,
  userId: string | null,
): Promise<DashboardStats> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Sales today
  let salesQuery = supabase
    .from('sales')
    .select('id, total, store_id, stores(name)')
    .eq('status', 'completed')
    .gte('created_at', today);

  if (role === 'seller' && userId) {
    salesQuery = salesQuery.eq('seller_id', userId);
  } else if (role !== 'admin' && storeId) {
    salesQuery = salesQuery.eq('store_id', storeId);
  }

  const { data: salesToday } = await salesQuery;
  const salesTodayTotal = (salesToday ?? []).reduce((s, r) => s + Number(r.total), 0);
  const salesTodayCount = salesToday?.length ?? 0;

  // Sales by store
  const storeMap = new Map<string, { store_name: string; total: number; count: number }>();
  for (const sale of salesToday ?? []) {
    const storeData = sale.stores as unknown as { name: string } | { name: string }[] | null;
    const name = Array.isArray(storeData) ? (storeData[0]?.name ?? 'Desconocida') : (storeData?.name ?? 'Desconocida');
    const existing = storeMap.get(sale.store_id) ?? { store_name: name, total: 0, count: 0 };
    existing.total += Number(sale.total);
    existing.count += 1;
    storeMap.set(sale.store_id, existing);
  }

  // Active products
  const { count: activeProducts } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  // Active alerts
  let alertsQuery = supabase
    .from('stock_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  if (role !== 'admin' && storeId) {
    alertsQuery = alertsQuery.eq('store_id', storeId);
  }
  const { count: activeAlerts } = await alertsQuery;

  // Recent 5 sales
  let recentSalesQuery = supabase
    .from('sales')
    .select('id, ticket_number, total, status, created_at, users!sales_seller_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(5);
  if (role === 'seller' && userId) {
    recentSalesQuery = recentSalesQuery.eq('seller_id', userId);
  } else if (role !== 'admin' && storeId) {
    recentSalesQuery = recentSalesQuery.eq('store_id', storeId);
  }
  const { data: recentSalesRaw } = await recentSalesQuery;

  const recentSales: RecentSale[] = (recentSalesRaw ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    ticket_number: s.ticket_number as string,
    total: Number(s.total),
    status: s.status as 'completed' | 'voided',
    seller_name: (s.users as { full_name: string } | null)?.full_name ?? '',
    created_at: s.created_at as string,
  }));

  // Recent 5 movements
  let movQuery = supabase
    .from('stock_movements')
    .select('id, movement_type, quantity, created_at, product_variants(sku), stores(name)')
    .order('created_at', { ascending: false })
    .limit(5);
  if (role !== 'admin' && storeId) {
    movQuery = movQuery.eq('store_id', storeId);
  }
  const { data: recentMovRaw } = await movQuery;

  const recentMovements: RecentMovement[] = (recentMovRaw ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    variant_sku: (m.product_variants as { sku: string } | null)?.sku ?? '',
    movement_type: m.movement_type as RecentMovement['movement_type'],
    quantity: m.quantity as number,
    store_name: (m.stores as { name: string } | null)?.name ?? '',
    created_at: m.created_at as string,
  }));

  return {
    salesTodayTotal,
    salesTodayCount,
    salesByStore: Array.from(storeMap.values()),
    activeProducts: activeProducts ?? 0,
    activeAlerts: activeAlerts ?? 0,
    recentSales,
    recentMovements,
  };
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

/**
 * Dashboard page with role-based widgets.
 *
 * - Admin: global sales today, sales by store, active products, stock alerts,
 *   last 5 sales, last 5 stock movements.
 * - Manager: same widgets filtered to their assigned store.
 * - Seller: my sales today, quick POS access, last 5 own sales.
 *
 * Validates: Requirements 13.1, 13.2
 */
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const activeStoreId = useAuthStore((s) => s.active_store_id);

  const role = user?.role ?? 'seller';
  const greeting = user?.full_name ?? 'Usuario';

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats', role, activeStoreId, user?.id],
    queryFn: () => fetchDashboardStats(role, activeStoreId, user?.id ?? null),
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido, {greeting} — {ROLE_LABELS[role]}
        </p>
      </div>

      {/* Role-based widgets */}
      {role === 'admin' && (
        <AdminDashboard data={data} isLoading={isLoading} />
      )}
      {role === 'manager' && (
        <ManagerDashboard data={data} isLoading={isLoading} />
      )}
      {role === 'seller' && (
        <SellerDashboard data={data} isLoading={isLoading} />
      )}
    </div>
  );
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard({
  data,
  isLoading,
}: Readonly<{
  data: DashboardStats | undefined;
  isLoading: boolean;
}>) {
  return (
    <>
      {/* Stat cards — 4 columns desktop, 2 tablet, 1 mobile */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ventas de hoy (global)"
          value={formatMXN(data?.salesTodayTotal ?? 0)}
          description={`${data?.salesTodayCount ?? 0} ventas realizadas`}
          icon={Euro}
          isLoading={isLoading}
        />
        <StatCard
          label="Ventas por tienda"
          value={data?.salesByStore.length ?? 0}
          description="Tiendas con ventas hoy"
          icon={Store}
          isLoading={isLoading}
        />
        <StatCard
          label="Productos activos"
          value={data?.activeProducts ?? 0}
          description="En catálogo"
          icon={Package}
          isLoading={isLoading}
        />
        <StatCard
          label="Alertas de stock"
          value={data?.activeAlerts ?? 0}
          description="Alertas activas"
          icon={AlertTriangle}
          isLoading={isLoading}
        />
      </div>

      {/* Tables — 2 columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentSalesTable
          title="Últimas 5 ventas"
          sales={data?.recentSales ?? []}
          isLoading={isLoading}
        />
        <RecentMovementsTable
          title="Últimos 5 movimientos"
          movements={data?.recentMovements ?? []}
          isLoading={isLoading}
        />
      </div>
    </>
  );
}

// ─── Manager Dashboard ───────────────────────────────────────────────────────

function ManagerDashboard({
  data,
  isLoading,
}: Readonly<{
  data: DashboardStats | undefined;
  isLoading: boolean;
}>) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ventas de hoy (mi tienda)"
          value={formatMXN(data?.salesTodayTotal ?? 0)}
          description={`${data?.salesTodayCount ?? 0} ventas realizadas`}
          icon={Euro}
          isLoading={isLoading}
        />
        <StatCard
          label="Productos activos"
          value={data?.activeProducts ?? 0}
          description="En catálogo"
          icon={Package}
          isLoading={isLoading}
        />
        <StatCard
          label="Alertas de stock (mi tienda)"
          value={data?.activeAlerts ?? 0}
          description="Alertas activas"
          icon={AlertTriangle}
          isLoading={isLoading}
        />
        <StatCard
          label="Ventas realizadas hoy"
          value={data?.salesTodayCount ?? 0}
          description="Transacciones completadas"
          icon={ShoppingCart}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentSalesTable
          title="Últimas 5 ventas (mi tienda)"
          sales={data?.recentSales ?? []}
          isLoading={isLoading}
        />
        <RecentMovementsTable
          title="Últimos 5 movimientos (mi tienda)"
          movements={data?.recentMovements ?? []}
          isLoading={isLoading}
        />
      </div>
    </>
  );
}

// ─── Seller Dashboard ────────────────────────────────────────────────────────

function SellerDashboard({
  data,
  isLoading,
}: Readonly<{
  data: DashboardStats | undefined;
  isLoading: boolean;
}>) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Mis ventas de hoy"
          value={formatMXN(data?.salesTodayTotal ?? 0)}
          description={`${data?.salesTodayCount ?? 0} ventas realizadas`}
          icon={Euro}
          isLoading={isLoading}
        />
        {/* Quick POS access — spans 2 columns on larger screens */}
        <div className="sm:col-span-1 lg:col-span-2">
          <QuickAccessPOS />
        </div>
      </div>

      <RecentSalesTable
        title="Últimas 5 ventas propias"
        sales={data?.recentSales ?? []}
        isLoading={isLoading}
      />
    </>
  );
}
