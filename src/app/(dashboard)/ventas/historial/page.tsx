'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

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
import { SALE_STATUS_LABELS, DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SaleRow {
  id: string;
  ticket_number: string;
  store_id: string;
  seller_id: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  status: string;
  created_at: string;
  store: { id: string; name: string; code: string } | null;
  seller: { id: string; full_name: string } | null;
}

interface SalesResponse {
  data: SaleRow[];
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

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const label = SALE_STATUS_LABELS[status] ?? status;
  if (status === 'voided') {
    return <Badge variant="destructive">{label}</Badge>;
  }
  return <Badge variant="default">{label}</Badge>;
}

// ─── Columns ─────────────────────────────────────────────────────────────────

function buildColumns(onRowClick: (id: string) => void): ColumnDef<SaleRow>[] {
  return [
    {
      header: 'Ticket',
      accessor: 'ticket_number',
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          className="font-mono text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => onRowClick(row.id)}
        >
          {row.ticket_number}
        </button>
      ),
    },
    {
      header: 'Tienda',
      accessor: (row) => row.store?.name ?? '—',
      sortable: true,
    },
    {
      header: 'Vendedor',
      accessor: (row) => row.seller?.full_name ?? '—',
      sortable: true,
    },
    {
      header: 'Total',
      accessor: 'total',
      sortable: true,
      cell: (row) => formatMXN(row.total),
      className: 'text-right',
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
  ];
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Sales history page with filters (store, seller, date range, status) and pagination.
 *
 * Validates: Requirements 6.9, 10.5
 */
export default function HistorialVentasPage() {
  const router = useRouter();
  const { activeStoreId } = useStore();
  const supabase = createClient();

  // Filter state
  const [storeId, setStoreId] = useState<string>(activeStoreId ?? 'all');
  const [sellerSearch, setSellerSearch] = useState('');
  const [debouncedSellerSearch, setDebouncedSellerSearch] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [sellerResults, setSellerResults] = useState<Array<{ id: string; full_name: string }>>([]);
  const [status, setStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Debounce seller search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSellerSearch(sellerSearch);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [sellerSearch]);

  // Search sellers
  useEffect(() => {
    if (!debouncedSellerSearch.trim() || selectedSellerId) {
      setSellerResults([]);
      return;
    }

    const fetchSellers = async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('id, full_name')
          .ilike('full_name', `%${debouncedSellerSearch.trim()}%`)
          .eq('is_active', true)
          .limit(10);
        setSellerResults(
          (data ?? []) as Array<{ id: string; full_name: string }>,
        );
      } catch {
        // Silently fail
      }
    };

    fetchSellers();
  }, [debouncedSellerSearch, selectedSellerId, supabase]);

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

  // Fetch sales
  const { data: response, isLoading } = useQuery<SalesResponse>({
    queryKey: ['sales-history', page, storeId, selectedSellerId, status, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(DEFAULT_PAGE_SIZE));
      if (storeId && storeId !== 'all') params.set('store_id', storeId);
      if (selectedSellerId) params.set('seller_id', selectedSellerId);
      if (status && status !== 'all') params.set('status', status);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/sales?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar historial de ventas');
      return res.json();
    },
  });

  const salesData = response?.data ?? [];
  const pagination = response?.pagination ?? {
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_count: 0,
    total_pages: 0,
  };

  const navigateToDetail = useCallback(
    (id: string) => {
      router.push(`/ventas/${id}`);
    },
    [router],
  );

  const columns = buildColumns(navigateToDetail);

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold">Historial de Ventas</h1>

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

        {/* Seller search */}
        <div className="relative flex-1 sm:min-w-[200px] sm:max-w-[280px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedor..."
            value={sellerSearch}
            onChange={(e) => {
              setSellerSearch(e.target.value);
              if (!e.target.value.trim()) {
                setSelectedSellerId(null);
                setPage(1);
              }
            }}
            className="pl-9"
          />
          {sellerResults.length > 0 && !selectedSellerId && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setSelectedSellerId(null);
                  setSellerSearch('');
                  setSellerResults([]);
                  setPage(1);
                }}
              >
                Todos los vendedores
              </button>
              {sellerResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setSelectedSellerId(s.id);
                    setSellerSearch(s.full_name);
                    setSellerResults([]);
                    setPage(1);
                  }}
                >
                  {s.full_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status filter */}
        <Select value={status} onValueChange={handleFilterChange(setStatus)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado">
              {(value: string) => {
                if (!value || value === 'all') return 'Todos los estados';
                return SALE_STATUS_LABELS[value] ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(SALE_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} label={label}>
                {label}
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
      <DataTable<SaleRow>
        columns={columns}
        data={salesData}
        isLoading={isLoading}
        emptyMessage="No se encontraron ventas."
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
