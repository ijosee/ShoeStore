'use client';

/**
 * Printer management configuration page.
 *
 * Allows Admin to connect/disconnect Bluetooth printers,
 * configure paper width, and test print.
 *
 * Validates: Requirements 10.3, 10.4, 10.6
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Bluetooth,
  BluetoothOff,
  Printer,
  TestTube,
  Unplug,
  FileDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import { usePrinter } from '@/hooks/usePrinter';
import type { PaperWidth, TicketData } from '@/types/printing';
import { buildTicket } from '@/lib/printing/escpos-builder';
import { generateTicketPDF } from '@/lib/printing/pdf-fallback';

// ─── Test ticket data ────────────────────────────────────────────────────────

const TEST_TICKET: TicketData = {
  store: {
    name: 'Tienda de Prueba',
    address: 'Av. Test #123',
    phone: '(555) 000-0000',
    tax_id: 'TEST010101000',
    return_policy_text: 'Este es un ticket de prueba.',
  },
  ticket_number: 'TEST-0001',
  seller_name: 'Prueba',
  lines: [
    {
      product_name: 'Producto de Prueba',
      variant: 'T27-Negro',
      quantity: 1,
      unit_price: 100,
      line_discount: 0,
      line_total: 116,
    },
  ],
  subtotal: 100,
  discount_amount: 0,
  tax_amount: 16,
  total: 116,
  payments: [{ method: 'Efectivo', amount: 116, received: 200, change: 84 }],
  created_at: new Date().toISOString(),
};

// ─── Status badge ────────────────────────────────────────────────────────────

function ConnectionBadge({ status }: Readonly<{ status: string }>) {
  switch (status) {
    case 'connected':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <Bluetooth className="mr-1 size-3" />
          Conectada
        </Badge>
      );
    case 'connecting':
      return (
        <Badge variant="secondary">
          <Bluetooth className="mr-1 size-3 animate-pulse" />
          Conectando...
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive">
          <BluetoothOff className="mr-1 size-3" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <BluetoothOff className="mr-1 size-3" />
          Desconectada
        </Badge>
      );
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ImpresorasConfigPage() {
  const { hasPermission } = usePermissions();
  const {
    status,
    config,
    lastError,
    isConnected,
    isBluetoothSupported,
    connect,
    disconnect,
    printTicket,
    downloadPDF,
    setPaperWidth,
  } = usePrinter();

  const [selectedWidth, setSelectedWidth] = useState<PaperWidth>('80mm');
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  const canManage = hasPermission('config.manage');

  const handleConnect = async () => {
    try {
      await connect(selectedWidth);
      toast.success('Impresora conectada correctamente');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al conectar impresora',
      );
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.info('Impresora desconectada');
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    try {
      await printTicket(TEST_TICKET);
      toast.success('Ticket de prueba enviado a la impresora');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al imprimir ticket de prueba',
      );
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleTestPDF = () => {
    downloadPDF(TEST_TICKET, 'ticket-prueba.pdf');
    toast.success('PDF de prueba descargado');
  };

  const handlePaperWidthChange = (width: PaperWidth) => {
    setSelectedWidth(width);
    if (isConnected) {
      setPaperWidth(width);
    }
  };

  if (!canManage) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">
          No tienes permisos para acceder a esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Impresoras</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona las impresoras térmicas Bluetooth conectadas a este
          dispositivo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Printer className="size-5" />
                Conexión Bluetooth
              </span>
              <ConnectionBadge status={status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isBluetoothSupported && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                <p className="font-medium">Bluetooth no disponible</p>
                <p className="mt-1">
                  Tu navegador no soporta Web Bluetooth. Usa Chrome o Edge en
                  un dispositivo con Bluetooth. Como alternativa, puedes
                  generar tickets en PDF.
                </p>
              </div>
            )}

            {/* Paper width selector */}
            <div className="space-y-2">
              <Label htmlFor="paper-width-printer">Ancho de Papel</Label>
              <Select
                value={selectedWidth}
                onValueChange={(val) =>
                  handlePaperWidthChange(val as PaperWidth)
                }
              >
                <SelectTrigger id="paper-width-printer" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm (32 caracteres)</SelectItem>
                  <SelectItem value="80mm">80mm (48 caracteres)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Connected printer info */}
            {isConnected && config && (
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-sm font-medium">{config.name}</p>
                <p className="text-xs text-muted-foreground">
                  ID: {config.id}
                </p>
                <p className="text-xs text-muted-foreground">
                  Papel: {config.paper_width} ({config.characters_per_line}{' '}
                  caracteres/línea)
                </p>
              </div>
            )}

            {/* Error message */}
            {lastError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {lastError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {!isConnected ? (
                <Button
                  onClick={handleConnect}
                  disabled={!isBluetoothSupported || status === 'connecting'}
                >
                  <Bluetooth className="mr-2 size-4" />
                  {status === 'connecting'
                    ? 'Conectando...'
                    : 'Conectar Impresora'}
                </Button>
              ) : (
                <Button variant="outline" onClick={handleDisconnect}>
                  <Unplug className="mr-2 size-4" />
                  Desconectar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Test Print Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="size-5" />
              Prueba de Impresión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envía un ticket de prueba para verificar que la impresora
              funciona correctamente, o descarga un PDF de ejemplo.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleTestPrint}
                disabled={!isConnected || isTestPrinting}
              >
                <Printer className="mr-2 size-4" />
                {isTestPrinting ? 'Imprimiendo...' : 'Imprimir Prueba'}
              </Button>

              <Button variant="outline" onClick={handleTestPDF}>
                <FileDown className="mr-2 size-4" />
                Descargar PDF de Prueba
              </Button>
            </div>

            {!isConnected && isBluetoothSupported && (
              <p className="text-xs text-muted-foreground">
                Conecta una impresora para enviar una prueba de impresión.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
