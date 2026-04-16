'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Ban, FileDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import { usePrinter } from '@/hooks/usePrinter';
import { formatMXN } from '@/lib/utils/currency';
import { SALE_STATUS_LABELS } from '@/lib/constants';
import { saleToTicketData, downloadTicketPDF } from '@/lib/printing/print-service';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SaleLine {
  id: string;
  variant_id: string;
  product_name: string;
  variant_description: string;
  quantity: number;
  unit_price: number;
  line_discount: number;
  tax_rate: number;
  line_subtotal: number;
  line_tax: number;
  line_total: number;
}

interface SalePayment {
  id: string;
  payment_method_id: string;
  amount: number;
  amount_received: number | null;
  change_amount: number | null;
  payment_methods: { id: string; name: string; icon: string | null } | null;
}

interface SaleDetail {
  id: string;
  ticket_number: string;
  store_id: string;
  seller_id: string;
  subtotal: number;
  discount_amount: number;
  discount_type: string | null;
  discount_value: number | null;
  tax_amount: number;
  total: number;
  status: string;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  stores: { id: string; name: string; code: string; address: string | null; phone: string | null } | null;
  users: { id: string; full_name: string; email: string } | null;
  sale_lines: SaleLine[];
  sale_payments: SalePayment[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
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

// ─── Void Dialog ─────────────────────────────────────────────────────────────

function VoidDialog({
  open,
  onOpenChange,
  ticketNumber,
  reason,
  onReasonChange,
  onConfirm,
  isLoading,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketNumber: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  isLoading: boolean;
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Anular Venta</DialogTitle>
          <DialogDescription>
            ¿Está seguro de anular la venta {ticketNumber}? Esta acción no se
            puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="void-reason">Motivo de anulación</Label>
          <Textarea
            id="void-reason"
            placeholder="Ingrese el motivo de la anulación..."
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={isLoading || !reason.trim()}
            onClick={onConfirm}
          >
            {isLoading && (
              <LoadingSpinner
                size="sm"
                className="border-current border-t-transparent"
              />
            )}
            Anular Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Sale detail page with lines, payments, totals, reprint and void options.
 *
 * Validates: Requirements 6.9, 10.5
 */
export default function VentaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { isConnected, printTicket } = usePrinter();
  const canVoid = hasPermission('sale.void');

  const saleId = params.id;

  // Void dialog state
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  // Fetch sale detail
  const {
    data: sale,
    isLoading,
    error,
  } = useQuery<SaleDetail>({
    queryKey: ['sale', saleId],
    queryFn: async () => {
      const res = await fetch(`/api/sales/${saleId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Error al cargar venta');
      }
      const json = await res.json();
      return json.data;
    },
    enabled: !!saleId,
  });

  // Void sale mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sales/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: saleId,
          reason: voidReason,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Error al anular venta');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      toast.success('Venta anulada correctamente');
      setVoidDialogOpen(false);
      setVoidReason('');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleVoidConfirm = useCallback(() => {
    if (!voidReason.trim()) {
      toast.error('Debe ingresar un motivo de anulación');
      return;
    }
    voidMutation.mutate();
  }, [voidReason, voidMutation]);

  const handleReprint = useCallback(async () => {
    if (!sale) return;

    const ticketData = saleToTicketData(sale);

    if (isConnected) {
      try {
        await printTicket(ticketData);
        toast.success('Ticket enviado a la impresora');
      } catch {
        toast.error('Error al imprimir. Descargando PDF como alternativa.');
        downloadTicketPDF(ticketData);
      }
    } else {
      downloadTicketPDF(ticketData);
      toast.success('PDF del ticket descargado');
    }
  }, [sale, isConnected, printTicket]);

  const handleDownloadPDF = useCallback(() => {
    if (!sale) return;
    const ticketData = saleToTicketData(sale);
    downloadTicketPDF(ticketData);
    toast.success('PDF del ticket descargado');
  }, [sale]);

  // ─── Loading / Error states ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          Volver
        </Button>
        <p className="text-destructive">
          {error instanceof Error ? error.message : 'Venta no encontrada'}
        </p>
      </div>
    );
  }

  const isVoided = sale.status === 'voided';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/ventas/historial')}
          >
            <ArrowLeft className="mr-1 size-4" />
            Historial
          </Button>
          <h1 className="text-2xl font-bold">{sale.ticket_number}</h1>
          <StatusBadge status={sale.status} />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReprint}>
            <Printer className="mr-2 size-4" />
            Reimprimir Ticket
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <FileDown className="mr-2 size-4" />
            PDF
          </Button>
          {canVoid && !isVoided && (
            <Button
              variant="destructive"
              onClick={() => setVoidDialogOpen(true)}
            >
              <Ban className="mr-2 size-4" />
              Anular Venta
            </Button>
          )}
        </div>
      </div>

      {/* Sale info card */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Venta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Ticket</span>
              <p className="font-medium font-mono">{sale.ticket_number}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tienda</span>
              <p className="font-medium">{sale.stores?.name ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vendedor</span>
              <p className="font-medium">{sale.users?.full_name ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Fecha</span>
              <p className="font-medium">{formatDate(sale.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voided info */}
      {isVoided && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Venta Anulada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Motivo</span>
                <p className="font-medium">{sale.void_reason ?? '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Anulada por</span>
                <p className="font-medium">{sale.voided_by ?? '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fecha de anulación</span>
                <p className="font-medium">
                  {sale.voided_at ? formatDate(sale.voided_at) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lines table */}
      <Card>
        <CardHeader>
          <CardTitle>Líneas de Venta ({sale.sale_lines.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">P. Unitario</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.sale_lines.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-16 text-center text-muted-foreground"
                    >
                      Sin líneas
                    </TableCell>
                  </TableRow>
                ) : (
                  sale.sale_lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">
                        {line.product_name}
                      </TableCell>
                      <TableCell>{line.variant_description}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatMXN(line.unit_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.line_discount > 0
                          ? formatMXN(line.line_discount)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMXN(line.line_subtotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMXN(line.line_tax)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMXN(line.line_total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payments and Totals */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Recibido</TableHead>
                    <TableHead className="text-right">Cambio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.sale_payments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-16 text-center text-muted-foreground"
                      >
                        Sin pagos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    sale.sale_payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {payment.payment_methods?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMXN(payment.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.amount_received == null
                            ? '—'
                            : formatMXN(payment.amount_received)}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.change_amount == null || payment.change_amount <= 0
                            ? '—'
                            : formatMXN(payment.change_amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Totals summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMXN(sale.subtotal)}</span>
              </div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Descuento
                    {sale.discount_type === 'percentage' && sale.discount_value
                      ? ` (${sale.discount_value}%)`
                      : ''}
                  </span>
                  <span className="text-destructive">
                    -{formatMXN(sale.discount_amount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA</span>
                <span>{formatMXN(sale.tax_amount)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-base font-bold">
                <span>Total</span>
                <span>{formatMXN(sale.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Void confirmation dialog with reason input */}
      <VoidDialog
        open={voidDialogOpen}
        onOpenChange={(open) => {
          setVoidDialogOpen(open);
          if (!open) setVoidReason('');
        }}
        ticketNumber={sale.ticket_number}
        reason={voidReason}
        onReasonChange={setVoidReason}
        onConfirm={handleVoidConfirm}
        isLoading={voidMutation.isPending}
      />
    </div>
  );
}
