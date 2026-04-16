'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KardexTable, type KardexRow } from '@/components/inventory/KardexTable';
import { Pagination } from '@/components/shared/Pagination';
import { useStore } from '@/hooks/useStore';
import { createClient } from '@/lib/supabase/client';
import { MOVEMENT_TYPE_LABELS, SEARCH_DEBOUNCE_MS } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

const KARDEX_PAGE_SIZE = 50;

interface KardexResponse {
  data: KardexRow[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Kardex (stock movements) page with filters and pagination (50 per page).
 *
 * Validates: Requirements 3.4, 3.5
 */
export default function MovimientosPage() {
  const { activeStoreId } = useStore();
  const supabase = createClient();

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [storeId, setStoreId] = useState<string>(activeStoreId ?? 'all');
  const [movementType, setMovementType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // We need to resolve variant_id from search — for now we pass search to the API
  // which filters by product name / SKU via the stock endpoint.
  // The kardex API doesn't support text search directly, so we'll filter client-side
  // or use variant_id if we had one. For simplicity, we'll do a two-step approach:
  // search variants first, then filter kardex by variant_id.

  const [variantId, setVariantId] = useState<string | null>(null);
  const [variantSearchResults, setVariantSearchResults] = useState<
    Array<{ variant_id: string; label: string }>
  >([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Search variants when debounced search changes
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setVariantSearchResults([]);
      setVariantId(null);
      return;
    }

    const mapStockItem = (item: Record<string, unknown>) => {
      const variant = item.variant as Record<string, unknown>;
      const product = item.product as Record<string, unknown>;
      const size = variant?.size as { value: string } | null;
      const color = variant?.color as { name: string } | null;

      const productName = typeof product?.name === 'string' ? product.name : '';
      const variantSku = typeof variant?.sku === 'string' ? variant.sku : '';
      const sizeValue = size?.value ?? '';
      const colorName = color?.name ?? '';

      return {
        variant_id: item.variant_id as string,
        label: `${productName} — ${variantSku} T${sizeValue} ${colorName}`,
      };
    };

    const deduplicateByVariantId = (
      items: Array<{ variant_id: string; label: string }>,
    ) => {
      const seen = new Set<string>();
      return items.filter((v) => {
        if (seen.has(v.variant_id)) return false;
        seen.add(v.variant_id);
        return true;
      });
    };

    const fetchVariants = async () => {
      try {
        const params = new URLSearchParams({
          search: debouncedSearch.trim(),
          page_size: '10',
        });
        const res = await fetch(`/api/inventory/stock?${params.toString()}`);
        if (!res.ok) return;
        const json = await res.json();

        const results = (json.data ?? []).map(mapStockItem);
        setVariantSearchResults(deduplicateByVariantId(results));
      } catch {
        // Silently fail
      }
    };

    fetchVariants();
  }, [debouncedSearch]);

  // Reset page on filter change
  const handleFilterChange = useCallback(
    (setter: (val: string) => void) => (val: string | null) => {
      setter(val ?? 'all');
      setPage(1);
    },
    [],
  );

  // Fetch stores
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

  // Fetch kardex data
  const { data: response, isLoading } = useQuery<KardexResponse>({
    queryKey: ['kardex', page, variantId, storeId, movementType, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(KARDEX_PAGE_SIZE));
      if (variantId) params.set('variant_id', variantId);
      if (storeId && storeId !== 'all') params.set('store_id', storeId);
      if (movementType && movementType !== 'all') params.set('movement_type', movementType);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/inventory/kardex?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar movimientos');
      return res.json();
    },
  });

  const kardexData = response?.data ?? [];
  const pagination = response?.pagination ?? {
    page: 1,
    page_size: KARDEX_PAGE_SIZE,
    total_count: 0,
    total_pages: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold">Movimientos de Stock (Kardex)</h1>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Variant search */}
        <div className="relative flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto/variante..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value.trim()) {
                setVariantId(null);
                setPage(1);
              }
            }}
            className="pl-9"
          />
          {/* Variant dropdown */}
          {variantSearchResults.length > 0 && !variantId && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setVariantId(null);
                  setVariantSearchResults([]);
                  setPage(1);
                }}
              >
                Todos los productos
              </button>
              {variantSearchResults.map((v) => (
                <button
                  key={v.variant_id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setVariantId(v.variant_id);
                    setSearch(v.label);
                    setVariantSearchResults([]);
                    setPage(1);
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
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

        <Select value={movementType} onValueChange={handleFilterChange(setMovementType)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo de movimiento">
              {(value: string) => {
                if (!value || value === 'all') return 'Todos los tipos';
                return MOVEMENT_TYPE_LABELS[value] ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(MOVEMENT_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} label={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-40"
            placeholder="Desde"
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
            placeholder="Hasta"
          />
        </div>
      </div>

      {/* Table */}
      <KardexTable data={kardexData} isLoading={isLoading} />

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
