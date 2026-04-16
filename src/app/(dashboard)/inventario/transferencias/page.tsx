'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { usePermissions } from '@/hooks/usePermissions';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PAGE_SIZE, TRANSFER_STATUS_LABELS } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TransferRow {
  id: string;
  transfer_number: string;
  source_store: { id: string; name: string; code: string } | null;
  destination_store: { id: string; name: string; code: string } | null;
  status: string;
  note: string | null;
  created_by_user: { id: string; full_name: string } | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TransferStatusBadge({ status }: Readonly<{ status: string }>) {
  const label = TRANSFER_STATUS_LABELS[status] ?? status;
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive'> = {
    confirmed: 'default',
    pending: 'secondary',
    cancelled: 'destructive',
  };
  return <Badge variant={variantMap[status] ?? 'secondary'}>{label}</Badge>;
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const columns: ColumnDef<TransferRow>[] = [
  {
    header: 'Número',
    accessor: 'transfer_number',
    sortable: true,
    cell: (row) => (
      <span className="font-mono text-sm font-medium">{row.transfer_number}</span>
    ),
  },
  {
    header: 'Tienda Origen',
    accessor: (row) => row.source_store?.name ?? '',
    sortable: true,
    cell: (row) => row.source_store?.name ?? '—',
  },
  {
    header: 'Tienda Destino',
    accessor: (row) => row.destination_store?.name ?? '',
    sortable: true,
    cell: (row) => row.destination_store?.name ?? '—',
  },
  {
    header: 'Estado',
    accessor: 'status',
    cell: (row) => <TransferStatusBadge status={row.status} />,
  },
  {
    header: 'Fecha',
    accessor: 'created_at',
    sortable: true,
    cell: (row) => (
      <span className="whitespace-nowrap text-sm">{formatDate(row.created_at)}</span>
    ),
  },
  {
    header: 'Creado por',
    accessor: (row) => row.created_by_user?.full_name ?? '',
    cell: (row) => row.created_by_user?.full_name ?? '—',
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Transfers list page.
 *
 * Validates: Requirements 4.1, 4.4
 */
export default function TransferenciasPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canTransfer = hasPermission('transfer.create');
  const supabase = createClient();

  const [page, setPage] = useState(1);

  // Fetch transfers
  const { data: response, isLoading } = useQuery({
    queryKey: ['transfers', page],
    queryFn: async () => {
      const pageSize = DEFAULT_PAGE_SIZE;
      const offset = (page - 1) * pageSize;

      const { data, count, error } = await supabase
        .from('stock_transfers')
        .select(
          `
          id,
          transfer_number,
          status,
          note,
          created_at,
          source_store:stores!stock_transfers_source_store_id_fkey ( id, name, code ),
          destination_store:stores!stock_transfers_destination_store_id_fkey ( id, name, code ),
          created_by_user:users!stock_transfers_created_by_fkey ( id, full_name )
        `,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      const transfers: TransferRow[] = (data ?? []).map((t: Record<string, unknown>) => ({
        id: t.id as string,
        transfer_number: t.transfer_number as string,
        source_store: t.source_store as TransferRow['source_store'],
        destination_store: t.destination_store as TransferRow['destination_store'],
        status: t.status as string,
        note: t.note as string | null,
        created_by_user: t.created_by_user as TransferRow['created_by_user'],
        created_at: t.created_at as string,
      }));

      const totalCount = count ?? 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: transfers,
        pagination: { page, page_size: pageSize, total_count: totalCount, total_pages: totalPages },
      };
    },
  });

  const transfers = response?.data ?? [];
  const pagination = response?.pagination ?? {
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_count: 0,
    total_pages: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Transferencias</h1>
        {canTransfer && (
          <Button onClick={() => router.push('/inventario/transferencias/nueva')}>
            <Plus className="mr-2 size-4" />
            Nueva Transferencia
          </Button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={transfers}
        isLoading={isLoading}
        emptyMessage="No se encontraron transferencias."
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
