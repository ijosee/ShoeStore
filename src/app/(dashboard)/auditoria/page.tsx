'use client';

/**
 * Audit log page with DataTable, filters, pagination, and expandable detail.
 *
 * Shows old/new values in expandable rows. Admin and Manager only.
 *
 * Validates: Requirements 12.4
 */

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, ChevronRight, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/shared/Pagination';
import { usePermissions } from '@/hooks/usePermissions';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string;
  store_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<string, string> = {
  INSERT: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  create: 'Creación',
  update: 'Actualización',
  delete: 'Eliminación',
  sale_confirm: 'Venta confirmada',
  sale_void: 'Venta anulada',
  return_process: 'Devolución procesada',
  stock_adjust: 'Ajuste de stock',
  stock_transfer: 'Transferencia',
  user_create: 'Usuario creado',
  user_update: 'Usuario actualizado',
  login: 'Inicio de sesión',
  login_failed: 'Inicio de sesión fallido',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  products: 'Producto',
  product_variants: 'Variante',
  stock_levels: 'Stock',
  stock_adjustments: 'Ajuste',
  stock_transfers: 'Transferencia',
  sales: 'Venta',
  returns: 'Devolución',
  users: 'Usuario',
  categories: 'Categoría',
  brands: 'Marca',
  payment_methods: 'Método de pago',
  stores: 'Tienda',
};

const ACTION_TYPES = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'sale_confirm',
  'sale_void',
  'return_process',
  'stock_adjust',
  'stock_transfer',
];

const ENTITY_TYPES = [
  'products',
  'product_variants',
  'stock_levels',
  'stock_adjustments',
  'stock_transfers',
  'sales',
  'returns',
  'users',
];

// ─── JSON Viewer ─────────────────────────────────────────────────────────────

function JsonViewer({ data, label }: { data: Record<string, unknown> | null; label: string }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground italic">Sin datos</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
      <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AuditoriaPage() {
  const router = useRouter();
  const { role, hasPermission } = usePermissions();
  const supabase = createClient();

  // Filter state
  const [actionType, setActionType] = useState<string>('all');
  const [entityType, setEntityType] = useState<string>('all');
  const [storeId, setStoreId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const canView = hasPermission('audit.view');

  // Redirect unauthorized users
  useEffect(() => {
    if (role && !canView) {
      router.replace('/');
    }
  }, [role, canView, router]);

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

  // Fetch audit logs
  const { data: response, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit-logs', page, actionType, entityType, storeId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(DEFAULT_PAGE_SIZE));
      if (actionType && actionType !== 'all') params.set('action_type', actionType);
      if (entityType && entityType !== 'all') params.set('entity_type', entityType);
      if (storeId && storeId !== 'all') params.set('store_id', storeId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar auditoría');
      return res.json();
    },
    enabled: canView,
  });

  const logs = response?.data ?? [];
  const pagination = response?.pagination ?? {
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_count: 0,
    total_pages: 0,
  };

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  }, []);

  if (role && !canView) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Auditoría</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={actionType} onValueChange={handleFilterChange(setActionType)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo de acción">
              {(value: string) => {
                if (!value || value === 'all') return 'Todas las acciones';
                return ACTION_TYPE_LABELS[value] ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {ACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t} label={ACTION_TYPE_LABELS[t] ?? t}>
                {ACTION_TYPE_LABELS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={entityType} onValueChange={handleFilterChange(setEntityType)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Entidad">
              {(value: string) => {
                if (!value || value === 'all') return 'Todas las entidades';
                return ENTITY_TYPE_LABELS[value] ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las entidades</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t} label={ENTITY_TYPE_LABELS[t] ?? t}>
                {ENTITY_TYPE_LABELS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="w-full sm:w-40"
            placeholder="Desde"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="w-full sm:w-40"
            placeholder="Hasta"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>ID Entidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No se encontraron registros de auditoría.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedRows.has(log.id);
                return (
                  <Fragment key={log.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(log.id)}
                    >
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" aria-label="Expandir detalle">
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.user_name ?? log.user_email ?? 'Sistema'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ACTION_TYPE_LABELS[log.action_type] ?? log.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ENTITY_TYPE_LABELS[log.entity_type] ?? log.entity_type}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate font-mono text-xs">
                        {log.entity_id}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <JsonViewer data={log.old_values} label="Valores anteriores" />
                            <JsonViewer data={log.new_values} label="Valores nuevos" />
                          </div>
                          {log.ip_address && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              IP: {log.ip_address}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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


