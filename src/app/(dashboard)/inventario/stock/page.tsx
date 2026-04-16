'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StockTable, type StockRow } from '@/components/inventory/StockTable';
import { Pagination } from '@/components/shared/Pagination';
import { useStore } from '@/hooks/useStore';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StockResponse {
  data: StockRow[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Stock levels page with filters, color-coded quantities, and CSV export.
 *
 * Validates: Requirements 3.1, 3.6, 5.1, 13.1
 */
export default function StockPage() {
  const { activeStoreId } = useStore();
  const supabase = createClient();

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [storeId, setStoreId] = useState<string>(activeStoreId ?? 'all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [brandId, setBrandId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  const handleFilterChange = useCallback(
    (setter: (val: string) => void) => (val: string | null) => {
      setter(val ?? 'all');
      setPage(1);
    },
    [],
  );

  // Fetch filter options
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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  // Fetch stock data
  const { data: response, isLoading } = useQuery<StockResponse>({
    queryKey: ['stock', page, debouncedSearch, storeId, categoryId, brandId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(DEFAULT_PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (storeId && storeId !== 'all') params.set('store_id', storeId);
      if (categoryId && categoryId !== 'all') params.set('category_id', categoryId);
      if (brandId && brandId !== 'all') params.set('brand_id', brandId);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/inventory/stock?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar stock');
      return res.json();
    },
  });

  const stockData = response?.data ?? [];
  const pagination = response?.pagination ?? {
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_count: 0,
    total_pages: 0,
  };

  // CSV export placeholder
  const handleExportCSV = useCallback(() => {
    showToast('Exportación CSV próximamente disponible');
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Stock Actual</h1>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="mr-2 size-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={storeId} onValueChange={handleFilterChange(setStoreId)}>
          <SelectTrigger className="w-full sm:w-44">
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

        <Select value={categoryId} onValueChange={handleFilterChange(setCategoryId)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Categoría">
              {(value: string) => {
                if (!value || value === 'all') return 'Todas las categorías';
                return categories.find((c) => c.id === value)?.name ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id} label={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={brandId} onValueChange={handleFilterChange(setBrandId)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Marca">
              {(value: string) => {
                if (!value || value === 'all') return 'Todas las marcas';
                return brands.find((b) => b.id === value)?.name ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las marcas</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id} label={b.name}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Bajo</SelectItem>
            <SelectItem value="out">Agotado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <StockTable data={stockData} isLoading={isLoading} />

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

// Inline toast for export placeholder (avoids extra import at top level)
function showToast(message: string) {
  if (typeof globalThis.window !== 'undefined') {
    import('sonner').then(({ toast: t }) => t.info(message));
  }
}
