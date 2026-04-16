'use client';

import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StockRow {
  id: string;
  variant_id: string;
  store_id: string;
  quantity: number;
  low_stock_threshold: number;
  status: 'normal' | 'low' | 'out';
  updated_at: string;
  variant: {
    id: string | null;
    sku: string | null;
    barcode: string | null;
    price_override: number | null;
    is_active: boolean | null;
    size: { id: string; value: string } | null;
    color: { id: string; name: string; hex_code: string } | null;
  };
  product: {
    id: string | null;
    name: string | null;
    base_price: number | null;
    tax_rate: number | null;
    brand: { id: string; name: string } | null;
    category: { id: string; name: string } | null;
  };
  store: { id: string; name: string; code: string } | null;
}

export interface StockTableProps {
  data: StockRow[];
  isLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function QuantityCell({ quantity, threshold }: { quantity: number; threshold: number }) {
  let colorClass = 'text-green-700 bg-green-50';
  if (quantity === 0) {
    colorClass = 'text-red-700 bg-red-50';
  } else if (quantity <= threshold) {
    colorClass = 'text-yellow-700 bg-yellow-50';
  }

  return (
    <span className={`inline-flex min-w-[3rem] justify-center rounded-md px-2 py-0.5 text-sm font-semibold ${colorClass}`}>
      {quantity}
    </span>
  );
}

function StatusBadge({ status }: { status: 'normal' | 'low' | 'out' }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    normal: { label: 'Normal', variant: 'default' },
    low: { label: 'Bajo', variant: 'secondary' },
    out: { label: 'Agotado', variant: 'destructive' },
  };
  const { label, variant } = map[status] ?? map.normal;
  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const columns: ColumnDef<StockRow>[] = [
  {
    header: 'Producto',
    accessor: (row) => row.product.name ?? '',
    sortable: true,
    cell: (row) => (
      <span className="font-medium">{row.product.name ?? '—'}</span>
    ),
  },
  {
    header: 'SKU',
    accessor: (row) => row.variant.sku ?? '',
    sortable: true,
    cell: (row) => (
      <span className="font-mono text-sm">{row.variant.sku ?? '—'}</span>
    ),
  },
  {
    header: 'Talla',
    accessor: (row) => row.variant.size?.value ?? '',
    sortable: true,
    cell: (row) => row.variant.size?.value ?? '—',
  },
  {
    header: 'Color',
    accessor: (row) => row.variant.color?.name ?? '',
    sortable: true,
    cell: (row) => {
      const color = row.variant.color;
      if (!color) return '—';
      return (
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-3 rounded-full border"
            style={{ backgroundColor: color.hex_code }}
          />
          {color.name}
        </div>
      );
    },
  },
  {
    header: 'Tienda',
    accessor: (row) => row.store?.name ?? '',
    sortable: true,
    cell: (row) => row.store?.name ?? '—',
  },
  {
    header: 'Cantidad',
    accessor: 'quantity',
    sortable: true,
    cell: (row) => (
      <QuantityCell quantity={row.quantity} threshold={row.low_stock_threshold} />
    ),
  },
  {
    header: 'Umbral',
    accessor: 'low_stock_threshold',
    sortable: true,
  },
  {
    header: 'Estado',
    accessor: 'status',
    cell: (row) => <StatusBadge status={row.status} />,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Stock levels table with color-coded quantity cells.
 *
 * Validates: Requirements 3.1, 3.6, 13.1
 */
export function StockTable({ data, isLoading = false }: StockTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="No se encontraron registros de stock."
      rowKey="id"
    />
  );
}
