'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useStore } from '@/hooks/useStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AlertRow {
  id: string;
  variant_id: string;
  store_id: string;
  current_stock: number;
  threshold: number;
  status: string;
  created_at: string;
  variant: {
    id: string | null;
    sku: string | null;
    size: { id: string; value: string } | null;
    color: { id: string; name: string } | null;
    product_name: string | null;
  };
  store: { id: string; name: string; code: string } | null;
}

interface AlertsResponse {
  data: AlertRow[];
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

function getAlertCountLabel(count: number): string {
  return count === 1 ? '1 activa' : `${count} activas`;
}

// ─── Column builder ──────────────────────────────────────────────────────────

function buildColumns(onAcknowledge: (id: string) => void): ColumnDef<AlertRow>[] {
  return [
    {
      header: 'Producto',
      accessor: (row: AlertRow) => row.variant.product_name ?? '',
      sortable: true,
      cell: (row: AlertRow) => (
        <span className="font-medium">{row.variant.product_name ?? '—'}</span>
      ),
    },
    {
      header: 'SKU',
      accessor: (row: AlertRow) => row.variant.sku ?? '',
      cell: (row: AlertRow) => (
        <span className="font-mono text-sm">{row.variant.sku ?? '—'}</span>
      ),
    },
    {
      header: 'Variante',
      accessor: (row: AlertRow) =>
        `${row.variant.size?.value ?? ''} ${row.variant.color?.name ?? ''}`,
      cell: (row: AlertRow) => (
        <span className="text-sm">
          T{row.variant.size?.value ?? '—'} {row.variant.color?.name ?? ''}
        </span>
      ),
    },
    {
      header: 'Tienda',
      accessor: (row: AlertRow) => row.store?.name ?? '',
      sortable: true,
      cell: (row: AlertRow) => row.store?.name ?? '—',
    },
    {
      header: 'Stock Actual',
      accessor: 'current_stock' as keyof AlertRow,
      sortable: true,
      cell: (row: AlertRow) => {
        const cls = row.current_stock === 0 ? 'text-red-700' : 'text-yellow-700';
        return <span className={`font-semibold ${cls}`}>{row.current_stock}</span>;
      },
    },
    {
      header: 'Umbral',
      accessor: 'threshold' as keyof AlertRow,
      sortable: true,
    },
    {
      header: 'Fecha',
      accessor: 'created_at' as keyof AlertRow,
      sortable: true,
      cell: (row: AlertRow) => (
        <span className="whitespace-nowrap text-sm">{formatDate(row.created_at)}</span>
      ),
    },
    {
      header: 'Acciones',
      accessor: 'id' as keyof AlertRow,
      cell: (row: AlertRow) => (
        <Button variant="outline" size="sm" onClick={() => onAcknowledge(row.id)}>
          <CheckCircle className="mr-1 size-4" />
          Atender
        </Button>
      ),
    },
  ];
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Stock alerts page with option to acknowledge alerts.
 *
 * Validates: Requirements 13.1, 13.3
 */
export default function AlertasPage() {
  const { activeStoreId } = useStore();
  const queryClient = useQueryClient();

  // Acknowledge dialog state
  const [ackDialogOpen, setAckDialogOpen] = useState(false);
  const [ackAlertId, setAckAlertId] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState('');

  // Fetch alerts
  const { data: response, isLoading } = useQuery<AlertsResponse>({
    queryKey: ['alerts', activeStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeStoreId) params.set('store_id', activeStoreId);

      const res = await fetch(`/api/inventory/alerts?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar alertas');
      return res.json();
    },
  });

  const alerts = response?.data ?? [];

  // Acknowledge mutation
  const ackMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await fetch(`/api/inventory/alerts/${id}/acknowledge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Error al atender alerta');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts-count'] });
      toast.success('Alerta marcada como atendida');
      setAckDialogOpen(false);
      setAckAlertId(null);
      setAckNote('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const openAckDialog = useCallback((alertId: string) => {
    setAckAlertId(alertId);
    setAckNote('');
    setAckDialogOpen(true);
  }, []);

  const handleAcknowledge = useCallback(() => {
    if (!ackAlertId) return;
    ackMutation.mutate({ id: ackAlertId, note: ackNote.trim() || undefined });
  }, [ackAlertId, ackNote, ackMutation]);

  const columns = useMemo(() => buildColumns(openAckDialog), [openAckDialog]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bell className="size-6 text-yellow-600" />
        <h1 className="text-2xl font-bold">Alertas de Stock</h1>
        {alerts.length > 0 && (
          <Badge variant="destructive">{getAlertCountLabel(alerts.length)}</Badge>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={alerts}
        isLoading={isLoading}
        emptyMessage="No hay alertas activas. ¡Todo el stock está en niveles normales!"
        rowKey="id"
      />

      {/* Acknowledge Dialog */}
      <Dialog open={ackDialogOpen} onOpenChange={setAckDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar Alerta como Atendida</DialogTitle>
            <DialogDescription>
              Opcionalmente agregue una nota sobre las acciones tomadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ack-note">Nota (opcional)</Label>
              <Textarea
                id="ack-note"
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                placeholder="Ej: Se solicitó reabastecimiento al proveedor..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAckDialogOpen(false)}
              disabled={ackMutation.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleAcknowledge} disabled={ackMutation.isPending}>
              {ackMutation.isPending && (
                <LoadingSpinner size="sm" className="mr-2 border-current border-t-transparent" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
