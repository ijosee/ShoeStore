'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';

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
import { usePermissions } from '@/hooks/usePermissions';
import { createClient } from '@/lib/supabase/client';
import { formatMXN } from '@/lib/utils/currency';
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  base_price: number;
  is_active: boolean;
  primary_image_url: string | null;
  variant_count: number;
  total_stock: number;
  created_at: string;
}

interface ProductsResponse {
  data: ProductRow[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Product list page with search, filters, and pagination.
 *
 * Validates: Requirements 1.1, 1.9, 2.4, 2.5
 */
export default function ProductosPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('product.create');

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
  const handleCategoryChange = useCallback((val: string | null) => {
    setCategoryId(val ?? 'all');
    setPage(1);
  }, []);
  const handleBrandChange = useCallback((val: string | null) => {
    setBrandId(val ?? 'all');
    setPage(1);
  }, []);
  const handleStatusChange = useCallback((val: string | null) => {
    setStatusFilter(val ?? 'all');
    setPage(1);
  }, []);

  // Fetch categories and brands for filter dropdowns
  const supabase = createClient();

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

  // Fetch products
  const { data: response, isLoading } = useQuery<ProductsResponse>({
    queryKey: [
      'products',
      page,
      debouncedSearch,
      categoryId,
      brandId,
      statusFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(DEFAULT_PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (categoryId && categoryId !== 'all')
        params.set('category_id', categoryId);
      if (brandId && brandId !== 'all') params.set('brand_id', brandId);
      if (statusFilter === 'active') params.set('is_active', 'true');
      if (statusFilter === 'inactive') params.set('is_active', 'false');

      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar productos');
      return res.json();
    },
  });

  const products = response?.data ?? [];
  const pagination = response?.pagination ?? {
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_count: 0,
    total_pages: 0,
  };

  // Table columns
  const columns: ColumnDef<ProductRow>[] = [
    {
      header: 'Producto',
      accessor: 'name',
      sortable: true,
      cell: (row) => (
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => router.push(`/catalogo/productos/${row.id}`)}
        >
          {row.primary_image_url ? (
            <img
              src={row.primary_image_url}
              alt={row.name}
              className="size-10 rounded-md border object-cover"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
              N/A
            </div>
          )}
          <span className="font-medium text-primary hover:underline">{row.name}</span>
        </div>
      ),
    },
    {
      header: 'Marca',
      accessor: (row) => row.brand?.name ?? '—',
      sortable: true,
    },
    {
      header: 'Categoría',
      accessor: (row) => row.category?.name ?? '—',
      sortable: true,
    },
    {
      header: 'Precio',
      accessor: 'base_price',
      sortable: true,
      cell: (row) => formatMXN(row.base_price),
    },
    {
      header: 'Stock',
      accessor: 'total_stock',
      sortable: true,
      cell: (row) => (
        <span
          className={
            row.total_stock === 0 ? 'font-medium text-destructive' : ''
          }
        >
          {row.total_stock}
        </span>
      ),
    },
    {
      header: 'Estado',
      accessor: 'is_active',
      cell: (row) =>
        row.is_active ? (
          <Badge variant="default">Activo</Badge>
        ) : (
          <Badge variant="secondary">Inactivo</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        {canCreate && (
          <Button onClick={() => router.push('/catalogo/productos/nuevo')}>
            <Plus className="mr-2 size-4" />
            Nuevo Producto
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryId} onValueChange={handleCategoryChange}>
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

        <Select value={brandId} onValueChange={handleBrandChange}>
          <SelectTrigger className="w-full sm:w-44">
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

        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={products}
        isLoading={isLoading}
        emptyMessage="No se encontraron productos."
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
