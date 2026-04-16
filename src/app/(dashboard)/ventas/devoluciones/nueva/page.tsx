'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Search, CheckCircle2, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useStore } from '@/hooks/useStore';
import { usePrinter } from '@/hooks/usePrinter';
import { formatMXN } from '@/lib/utils/currency';
import { calculateRefund } from '@/lib/utils/tax';
import { RETURN_REASON_LABELS } from '@/lib/constants';
import { downloadReturnNotePDF, buildReturnNoteTicket } from '@/lib/printing/print-service';
import type { TicketData } from '@/types/printing';
import type { ReturnReason } from '@/types/database';

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
  created_at: string;
  stores: { id: string; name: string; code: string } | null;
  users: { id: string; full_name: string; email: string } | null;
  sale_lines: SaleLine[];
}

interface SelectedLine {
  sale_line_id: string;
  variant_id: string;
  quantity: number;
}

interface ProcessReturnResponse {
  data: {
    id: string;
    return_number: string;
    original_ticket: string;
    lines: Array<{
      product_name: string;
      variant_description: string;
      quantity: number;
      refund_amount: number;
    }>;
    total_refund: number;
    reason: string;
    processed_by: string;
    created_at: string;
  };
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

// ─── Step 1: Search Sale ─────────────────────────────────────────────────────

function StepSearchSale({
  onSaleFound,
}: Readonly<{
  onSaleFound: (sale: SaleDetail) => void;
}>) {
  const [ticketSearch, setTicketSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = ticketSearch.trim();
    if (!trimmed) {
      setSearchError('Ingrese un número de ticket');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // Search by ticket number — we need to find the sale ID first
      const res = await fetch(
        `/api/sales?ticket_number=${encodeURIComponent(trimmed)}&page_size=1`,
      );
      if (!res.ok) {
        throw new Error('Error al buscar la venta');
      }
      const json = await res.json();
      const sales = json.data ?? [];

      if (sales.length === 0) {
        setSearchError(
          `No se encontró ninguna venta con el ticket "${trimmed}"`,
        );
        return;
      }

      // Fetch full sale detail
      const saleId = sales[0].id;
      const detailRes = await fetch(`/api/sales/${saleId}`);
      if (!detailRes.ok) {
        throw new Error('Error al cargar el detalle de la venta');
      }
      const detailJson = await detailRes.json();
      const sale = detailJson.data as SaleDetail;

      if (sale.status === 'voided') {
        setSearchError(
          `La venta ${sale.ticket_number} está anulada y no permite devoluciones`,
        );
        return;
      }

      onSaleFound(sale);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : 'Error al buscar la venta',
      );
    } finally {
      setIsSearching(false);
    }
  }, [ticketSearch, onSaleFound]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Paso 1
          </Badge>
          Buscar Venta Original
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ticket-search">Número de Ticket</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ticket-search"
                placeholder="Ej: TC-2024-000142"
                value={ticketSearch}
                onChange={(e) => {
                  setTicketSearch(e.target.value);
                  setSearchError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <LoadingSpinner
                  size="sm"
                  className="border-current border-t-transparent"
                />
              ) : (
                'Buscar'
              )}
            </Button>
          </div>
        </div>

        {searchError && (
          <p className="text-sm text-destructive">{searchError}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Step 2: Select Items ────────────────────────────────────────────────────

function StepSelectItems({
  sale,
  selectedLines,
  onSelectionChange,
  onBack,
  onNext,
}: Readonly<{
  sale: SaleDetail;
  selectedLines: Map<string, SelectedLine>;
  onSelectionChange: (lines: Map<string, SelectedLine>) => void;
  onBack: () => void;
  onNext: () => void;
}>) {
  const toggleLine = useCallback(
    (line: SaleLine, checked: boolean) => {
      const next = new Map(selectedLines);
      if (checked) {
        next.set(line.id, {
          sale_line_id: line.id,
          variant_id: line.variant_id,
          quantity: line.quantity,
        });
      } else {
        next.delete(line.id);
      }
      onSelectionChange(next);
    },
    [selectedLines, onSelectionChange],
  );

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      const next = new Map(selectedLines);
      const existing = next.get(lineId);
      if (existing) {
        next.set(lineId, { ...existing, quantity });
      }
      onSelectionChange(next);
    },
    [selectedLines, onSelectionChange],
  );

  const hasSelection = selectedLines.size > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Paso 2
          </Badge>
          Seleccionar Artículos a Devolver
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sale info summary */}
        <div className="rounded-md border bg-muted/50 p-3">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
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
        </div>

        {/* Lines table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Producto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Cant. Vendida</TableHead>
                <TableHead className="text-right">P. Unitario</TableHead>
                <TableHead className="text-right">Total Línea</TableHead>
                <TableHead className="text-right">Cant. a Devolver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.sale_lines.map((line) => {
                const selected = selectedLines.get(line.id);
                const isChecked = !!selected;

                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          toggleLine(line, checked === true)
                        }
                        aria-label={`Seleccionar ${line.product_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {line.product_name}
                    </TableCell>
                    <TableCell>{line.variant_description}</TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatMXN(line.unit_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMXN(line.line_total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isChecked ? (
                        <Input
                          type="number"
                          min={1}
                          max={line.quantity}
                          value={selected.quantity}
                          onChange={(e) => {
                            const val = Math.max(
                              1,
                              Math.min(
                                line.quantity,
                                Number.parseInt(e.target.value, 10) || 1,
                              ),
                            );
                            updateQuantity(line.id, val);
                          }}
                          className="ml-auto w-20 text-right"
                          aria-label={`Cantidad a devolver de ${line.product_name}`}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" />
            Volver
          </Button>
          <Button onClick={onNext} disabled={!hasSelection}>
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Reason + Confirm ────────────────────────────────────────────────

function StepConfirm({
  sale,
  selectedLines,
  onBack,
  onConfirm,
  isProcessing,
}: Readonly<{
  sale: SaleDetail;
  selectedLines: Map<string, SelectedLine>;
  onBack: () => void;
  onConfirm: (reason: ReturnReason, reasonNote: string) => void;
  isProcessing: boolean;
}>) {
  const [reason, setReason] = useState<ReturnReason | ''>('');
  const [reasonNote, setReasonNote] = useState('');

  // Calculate refund summary
  const refundSummary = useMemo(() => {
    const items: Array<{
      product_name: string;
      variant_description: string;
      quantity: number;
      refund_amount: number;
    }> = [];

    let totalRefund = 0;

    for (const [lineId, selected] of selectedLines) {
      const saleLine = sale.sale_lines.find((l) => l.id === lineId);
      if (!saleLine) continue;

      const refundAmount = calculateRefund(
        { quantity: saleLine.quantity, line_total: saleLine.line_total },
        selected.quantity,
      );

      items.push({
        product_name: saleLine.product_name,
        variant_description: saleLine.variant_description,
        quantity: selected.quantity,
        refund_amount: refundAmount,
      });

      totalRefund += refundAmount;
    }

    return { items, totalRefund };
  }, [sale, selectedLines]);

  const isReasonOther = reason === 'other';
  const canConfirm =
    reason !== '' && (!isReasonOther || reasonNote.trim().length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Paso 3
          </Badge>
          Motivo y Confirmación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reason selection */}
        <div className="space-y-2">
          <Label htmlFor="return-reason">Motivo de Devolución</Label>
          <Select
            value={reason}
            onValueChange={(val) => setReason(val as ReturnReason)}
          >
            <SelectTrigger id="return-reason" className="w-full sm:w-80">
              <SelectValue placeholder="Seleccione un motivo">
                {(value: string) => {
                  if (!value) return 'Seleccione un motivo';
                  return RETURN_REASON_LABELS[value] ?? value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RETURN_REASON_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key} label={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Note */}
        <div className="space-y-2">
          <Label htmlFor="return-note">
            Nota {isReasonOther ? '(obligatoria)' : '(opcional)'}
          </Label>
          <Textarea
            id="return-note"
            placeholder="Describa detalles adicionales de la devolución..."
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </div>

        {/* Refund summary */}
        <div className="space-y-3">
          <h3 className="font-semibold">Resumen de Reembolso</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Reembolso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refundSummary.items.map((item) => (
                  <TableRow key={`${item.product_name}-${item.variant_description}`}>
                    <TableCell className="font-medium">
                      {item.product_name}
                    </TableCell>
                    <TableCell>{item.variant_description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatMXN(item.refund_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end border-t pt-3">
            <div className="text-right">
              <span className="text-sm text-muted-foreground">
                Total Reembolso
              </span>
              <p className="text-xl font-bold">
                {formatMXN(refundSummary.totalRefund)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} disabled={isProcessing}>
            <ArrowLeft className="mr-2 size-4" />
            Volver
          </Button>
          <Button
            onClick={() => onConfirm(reason as ReturnReason, reasonNote)}
            disabled={!canConfirm || isProcessing}
          >
            {isProcessing ? (
              <LoadingSpinner
                size="sm"
                className="mr-2 border-current border-t-transparent"
              />
            ) : null}
            Confirmar Devolución
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * New return page with 3-step flow:
 * 1. Search sale by ticket number
 * 2. Select items to return with quantity
 * 3. Reason + note + refund summary + confirmation
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */
export default function NuevaDevolucionPage() {
  const router = useRouter();
  const { activeStoreId } = useStore();
  const { isConnected, printRaw } = usePrinter();

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [selectedLines, setSelectedLines] = useState<Map<string, SelectedLine>>(
    new Map(),
  );
  const [returnResult, setReturnResult] =
    useState<ProcessReturnResponse['data'] | null>(null);

  // Step 1 → 2
  const handleSaleFound = useCallback((foundSale: SaleDetail) => {
    setSale(foundSale);
    setSelectedLines(new Map());
    setStep(2);
  }, []);

  // Step 2 → 1
  const handleBackToSearch = useCallback(() => {
    setSale(null);
    setSelectedLines(new Map());
    setStep(1);
  }, []);

  // Step 2 → 3
  const handleGoToConfirm = useCallback(() => {
    setStep(3);
  }, []);

  // Step 3 → 2
  const handleBackToSelect = useCallback(() => {
    setStep(2);
  }, []);

  // Process return mutation
  const processReturnMutation = useMutation({
    mutationFn: async ({
      reason,
      reasonNote,
    }: {
      reason: ReturnReason;
      reasonNote: string;
    }) => {
      if (!sale) throw new Error('No hay venta seleccionada');

      const lines = Array.from(selectedLines.values()).map((l) => ({
        sale_line_id: l.sale_line_id,
        variant_id: l.variant_id,
        quantity: l.quantity,
      }));

      const res = await fetch('/api/returns/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_sale_id: sale.id,
          store_id: activeStoreId ?? sale.store_id,
          reason,
          reason_note: reasonNote.trim() || null,
          lines,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.message ?? 'Error al procesar la devolución',
        );
      }

      return res.json() as Promise<ProcessReturnResponse>;
    },
    onSuccess: (data) => {
      setReturnResult(data.data);
      toast.success('Devolución procesada correctamente');

      // Auto-print return note if Bluetooth is connected
      if (isConnected && sale) {
        const returnData = data.data;
        const ticketData: TicketData = {
          store: {
            name: sale.stores?.name ?? 'Tienda',
            address: '',
            phone: '',
            tax_id: '',
          },
          ticket_number: returnData.return_number,
          seller_name: returnData.processed_by ?? '',
          lines: returnData.lines.map((l: { product_name: string; variant_description: string; quantity: number; refund_amount: number }) => ({
            product_name: l.product_name,
            variant: l.variant_description,
            quantity: l.quantity,
            unit_price: l.refund_amount / l.quantity,
            line_discount: 0,
            line_total: l.refund_amount,
          })),
          subtotal: returnData.total_refund,
          discount_amount: 0,
          tax_amount: 0,
          total: returnData.total_refund,
          payments: [],
          created_at: new Date().toISOString(),
        };

        const reason = RETURN_REASON_LABELS[returnData.reason] ?? returnData.reason;
        try {
          const bytes = buildReturnNoteTicket(
            ticketData,
            returnData.return_number,
            returnData.original_ticket,
            reason,
          );
          printRaw(bytes).catch(() => {
            // Silent fail — user can reprint manually
          });
        } catch {
          // Silent fail
        }
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleConfirm = useCallback(
    (reason: ReturnReason, reasonNote: string) => {
      processReturnMutation.mutate({ reason, reasonNote });
    },
    [processReturnMutation],
  );

  // ─── Success state ──────────────────────────────────────────────────────

  if (returnResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/ventas/devoluciones')}
          >
            <ArrowLeft className="mr-1 size-4" />
            Devoluciones
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="size-16 text-green-500" />
            <h2 className="text-2xl font-bold">Devolución Procesada</h2>
            <p className="text-lg font-mono">{returnResult.return_number}</p>
            <p className="text-muted-foreground">
              Ticket original: {returnResult.original_ticket}
            </p>
            <p className="text-xl font-bold">
              Reembolso: {formatMXN(returnResult.total_refund)}
            </p>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (!sale) return;
                  const ticketData: TicketData = {
                    store: {
                      name: sale.stores?.name ?? 'Tienda',
                      address: '',
                      phone: '',
                      tax_id: '',
                    },
                    ticket_number: returnResult.return_number,
                    seller_name: returnResult.processed_by ?? '',
                    lines: returnResult.lines.map((l: { product_name: string; variant_description: string; quantity: number; refund_amount: number }) => ({
                      product_name: l.product_name,
                      variant: l.variant_description,
                      quantity: l.quantity,
                      unit_price: l.refund_amount / l.quantity,
                      line_discount: 0,
                      line_total: l.refund_amount,
                    })),
                    subtotal: returnResult.total_refund,
                    discount_amount: 0,
                    tax_amount: 0,
                    total: returnResult.total_refund,
                    payments: [],
                    created_at: new Date().toISOString(),
                  };
                  const reason = RETURN_REASON_LABELS[returnResult.reason] ?? returnResult.reason;

                  if (isConnected) {
                    const bytes = buildReturnNoteTicket(
                      ticketData,
                      returnResult.return_number,
                      returnResult.original_ticket,
                      reason,
                    );
                    printRaw(bytes)
                      .then(() => toast.success('Nota enviada a la impresora'))
                      .catch(() => {
                        downloadReturnNotePDF(ticketData, returnResult.return_number, returnResult.original_ticket, reason);
                        toast.info('PDF de nota de devolución descargado');
                      });
                  } else {
                    downloadReturnNotePDF(ticketData, returnResult.return_number, returnResult.original_ticket, reason);
                    toast.success('PDF de nota de devolución descargado');
                  }
                }}
              >
                <Printer className="mr-2 size-4" />
                Imprimir Nota
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/ventas/devoluciones')}
              >
                Ver Devoluciones
              </Button>
              <Button
                onClick={() => {
                  setSale(null);
                  setSelectedLines(new Map());
                  setReturnResult(null);
                  setStep(1);
                }}
              >
                Nueva Devolución
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main flow ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/ventas/devoluciones')}
        >
          <ArrowLeft className="mr-1 size-4" />
          Devoluciones
        </Button>
        <h1 className="text-2xl font-bold">Nueva Devolución</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step >= 1 ? 'default' : 'outline'}>1. Buscar Venta</Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant={step >= 2 ? 'default' : 'outline'}>
          2. Seleccionar Artículos
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant={step >= 3 ? 'default' : 'outline'}>3. Confirmar</Badge>
      </div>

      {/* Steps */}
      {step === 1 && <StepSearchSale onSaleFound={handleSaleFound} />}

      {step === 2 && sale && (
        <StepSelectItems
          sale={sale}
          selectedLines={selectedLines}
          onSelectionChange={setSelectedLines}
          onBack={handleBackToSearch}
          onNext={handleGoToConfirm}
        />
      )}

      {step === 3 && sale && (
        <StepConfirm
          sale={sale}
          selectedLines={selectedLines}
          onBack={handleBackToSelect}
          onConfirm={handleConfirm}
          isProcessing={processReturnMutation.isPending}
        />
      )}
    </div>
  );
}
