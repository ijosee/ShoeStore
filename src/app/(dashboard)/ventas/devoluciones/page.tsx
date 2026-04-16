'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { useStore } from '@/hooks/useStore';
import { createClient } from '@/lib/supabase/client';
import { formatMXN } from '@/lib/utils/currency';
import { RETURN_REASON_LABELS, DEFAULT_PAGE_SIZE } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReturnRow {
  id: string;
  return_number: string;
  original_sale_id: string;
  original_ticket_number: string | null;
  store_id: string;
  store: { id: string; name: string; code: string } | null;
  processed_by: string;
  processor: { id: string; full_name: string } | null;
  approved_by: string | null;
  reason: string;
  reason_note: string | null;
  refund_amount: number;
  status: string;
  created_at: string;
}

interface ReturnsResponse {
  data: ReturnRow[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const RETURN_STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  cancelled: 'Cancelada',
};

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const label = RETURN_STATUS_LABELS[status] ?? status;
  if (status === 'cancelled') {
    return <Badge variant="destructive">{label}</Badge>;
  }
  return <Badge variant="default">{label}</Badge>;
}

// ─── Columns ─────────────────────────────────────────────────────────────────

function buildColumns(): ColumnDef<ReturnRow>[] {
  return [
    {
      header: 'Nº Devolución',
      accessor: 'return_number',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-sm">{row.return_number}</span>
      ),
    },
    {
      header: 'Ticket Original',
      accessor: (row) => row.original_ticket_number ?? '—',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-sm">
          {row.original_ticket_number ?? '—'}
        </span>
      ),
    },
    {
      header: 'Tienda',
      accessor: (row) => row.store?.name ?? '—',
      sortable: true,
    },
    {
      header: 'Reembolso',
      accessor: 'refund_amount',
      sortable: true,
      cell: (row) => formatMXN(row.refund_amount),
      className: 'text-right',
    },
    {
      header: 'Motivo',
      accessor: 'reason',
      sortable: true,
      cell: (row) => RETURN_REASON_LABELS[row.reason] ?? row.reason,
    },
    {
      header: 'Estado',
      accessor: 'status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Fecha',
      accessor: 'created_at',
      sortable: true,
      cell: (row) => formatDate(row.created_at),
    },
    {
      header: 'Procesado por',
      accessor: (row) => row.processor?.full_name ?? '—',
      sortable: true,
    },
  ];
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Returns list page with filters (store, date range) and pagination.
 *
 * Validates: Requirements 9.1, 9.2
 */
export default function DevolucionesPage() {
  const router = useRouter();
  const { activeStoreId } = useStore();
  const supabase = createClient();

  // Filter state
  const [storeId, setStoreId] = useState<string>(activeStoreId ?? 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Reset page on filter change
  const handleFilterChange = useCallback(
    (setter: (val: string) => void) => (val: string | null) => {
      setter(val ?? 'all');
      setPage(1);
    },
    [],
  );

  // Fetch stores for filter
  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as Array<{ id: string; name: string; code: string }>;
    },
  });

  // Fetch returns
  const { data: response, isLoading } = useQuery<ReturnsResponse>({
    queryKey: ['returns-list', page, storeId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(DEFAULT_PAGE_SIZE));
      if (storeId && storeId !== 'all') params.set('store_id', storeId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/returns?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar devoluciones');
      return res.json();
    },
  });

  const returnsData = response?.data ?? [];
  const pagination = response?.pagination ?? {
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_count: 0,
    total_pages: 0,
  };

  const columns = buildColumns();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Devoluciones</h1>
        <Button onClick={() => router.push('/ventas/devoluciones/nueva')}>
          <Plus className="mr-2 size-4" />
          Nueva Devolución
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Store filter */}
        <Select value={storeId} onValueChange={handleFilterChange(setStoreId)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tienda">
              {(value: string) => {
                if (!value || value === 'all') return 'Todas las tiendas';
                return stores.find((s) => s.id === value)?.name ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las tiendas</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id} label={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-40"
            aria-label="Fecha desde"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-40"
            aria-label="Fecha hasta"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable<ReturnRow>
        columns={columns}
        data={returnsData}
        isLoading={isLoading}
        emptyMessage="No se encontraron devoluciones."
        rowKey="id"
      />

      {/* Pagination */}
      {pagination.total_pages > 0 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.total_pages}
          totalCount={pagination.total_count}
          pageSize={pagination.page_size}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
