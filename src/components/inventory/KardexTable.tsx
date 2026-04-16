'use client';

import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MOVEMENT_TYPE_LABELS } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KardexRow {
  id: string;
  variant_id: string;
  store_id: string;
  movement_type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  user_id: string;
  created_at: string;
  variant: {
    id: string | null;
    sku: string | null;
    size: { id: string; value: string } | null;
    color: { id: string; name: string } | null;
    product_name: string | null;
  };
  user: { id: string; full_name: string; email: string } | null;
  store: { id: string; name: string; code: string } | null;
}

export interface KardexTableProps {
  data: KardexRow[];
  isLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function MovementTypeBadge({ type }: { type: string }) {
  const label = MOVEMENT_TYPE_LABELS[type] ?? type;

  const colorMap: Record<string, string> = {
    entry: 'bg-blue-100 text-blue-800',
    sale: 'bg-orange-100 text-orange-800',
    return: 'bg-green-100 text-green-800',
    adjustment: 'bg-purple-100 text-purple-800',
    transfer_out: 'bg-red-100 text-red-800',
    transfer_in: 'bg-teal-100 text-teal-800',
  };

  const colorClass = colorMap[type] ?? 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function QuantityChange({ quantity, type }: { quantity: number; type: string }) {
  const isPositive = ['entry', 'return', 'transfer_in', 'adjustment'].includes(type);
  // For adjustments, the sign depends on the actual quantity value
  const sign = type === 'adjustment'
    ? (quantity >= 0 ? '+' : '')
    : (isPositive ? '+' : '-');
  const colorClass = isPositive ? 'text-green-700' : 'text-red-700';

  return (
    <span className={`font-medium ${colorClass}`}>
      {sign}{Math.abs(quantity)}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const columns: ColumnDef<KardexRow>[] = [
  {
    header: 'Fecha',
    accessor: 'created_at',
    sortable: true,
    cell: (row) => (
      <span className="whitespace-nowrap text-sm">{formatDate(row.created_at)}</span>
    ),
  },
  {
    header: 'Producto',
    accessor: (row) => row.variant.product_name ?? '',
    sortable: true,
    cell: (row) => (
      <span className="font-medium">{row.variant.product_name ?? '—'}</span>
    ),
  },
  {
    header: 'SKU',
    accessor: (row) => row.variant.sku ?? '',
    cell: (row) => (
      <span className="font-mono text-sm">{row.variant.sku ?? '—'}</span>
    ),
  },
  {
    header: 'Tipo',
    accessor: 'movement_type',
    cell: (row) => <MovementTypeBadge type={row.movement_type} />,
  },
  {
    header: 'Cantidad',
    accessor: 'quantity',
    sortable: true,
    cell: (row) => <QuantityChange quantity={row.quantity} type={row.movement_type} />,
  },
  {
    header: 'Antes',
    accessor: 'stock_before',
    sortable: true,
  },
  {
    header: 'Después',
    accessor: 'stock_after',
    sortable: true,
  },
  {
    header: 'Tienda',
    accessor: (row) => row.store?.name ?? '',
    cell: (row) => row.store?.name ?? '—',
  },
  {
    header: 'Usuario',
    accessor: (row) => row.user?.full_name ?? '',
    cell: (row) => row.user?.full_name ?? '—',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Kardex (stock movements) table with movement type badges.
 *
 * Validates: Requirements 3.4, 3.5
 */
export function KardexTable({ data, isLoading = false }: KardexTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="No se encontraron movimientos de stock."
      rowKey="id"
    />
  );
}
