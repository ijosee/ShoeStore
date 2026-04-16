'use client';

/**
 * Ticket template configuration page.
 *
 * Allows Admin to configure: logo, header texts, footer text (return policy),
 * and toggle optional sections on the printed ticket.
 *
 * Validates: Requirements 10.6
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Save, Eye, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/hooks/usePermissions';
import { usePrinter } from '@/hooks/usePrinter';
import type { PaperWidth, TicketData } from '@/types/printing';
import { generateTicketPDF } from '@/lib/printing/pdf-fallback';

// ─── Sample ticket data for preview ──────────────────────────────────────────

function buildPreviewData(config: TicketTemplateConfig): TicketData {
  return {
    store: {
      name: config.storeName || 'Mi Tienda',
      address: config.storeAddress || 'Av. Principal #123, Col. Centro',
      phone: config.storePhone || '(555) 123-4567',
      tax_id: config.storeTaxId || 'XAXX010101000',
      return_policy_text: config.showReturnPolicy
        ? config.returnPolicyText
        : undefined,
    },
    ticket_number: 'TC-2024-000001',
    seller_name: 'Juan Pérez',
    lines: [
      {
        product_name: 'Zapato Oxford Classic',
        variant: 'T27-Negro',
        quantity: 1,
        unit_price: 1200,
        line_discount: 120,
        line_total: 1252.8,
      },
      {
        product_name: 'Tenis Sport Run',
        variant: 'T26-Blanco',
        quantity: 1,
        unit_price: 890,
        line_discount: 89,
        line_total: 929.16,
      },
    ],
    subtotal: 1881,
    discount_amount: 209,
    tax_amount: 300.96,
    total: 2181.96,
    payments: [
      {
        method: 'Tarjeta de Crédito',
        amount: 2181.96,
      },
    ],
    created_at: new Date().toISOString(),
  };
}

// ─── Config type ─────────────────────────────────────────────────────────────

interface TicketTemplateConfig {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeTaxId: string;
  returnPolicyText: string;
  paperWidth: PaperWidth;
  showReturnPolicy: boolean;
  showSellerName: boolean;
  showDiscountDetail: boolean;
}

const DEFAULT_CONFIG: TicketTemplateConfig = {
  storeName: '',
  storeAddress: '',
  storePhone: '',
  storeTaxId: '',
  returnPolicyText:
    'Cambios y devoluciones dentro de los 30 dias posteriores a la compra con ticket original.',
  paperWidth: '80mm',
  showReturnPolicy: true,
  showSellerName: true,
  showDiscountDetail: true,
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TicketConfigPage() {
  const { hasPermission } = usePermissions();
  const { isBluetoothSupported } = usePrinter();
  const [config, setConfig] = useState<TicketTemplateConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);

  const canManage = hasPermission('config.manage');

  const updateConfig = <K extends keyof TicketTemplateConfig>(
    key: K,
    value: TicketTemplateConfig[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // In a full implementation, this would save to the database
      // For now, we store in localStorage as a practical approach
      localStorage.setItem('ticket-template-config', JSON.stringify(config));
      toast.success('Configuración de ticket guardada');
    } catch {
      toast.error('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewPDF = () => {
    const previewData = buildPreviewData(config);
    const blob = generateTicketPDF(previewData);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 10000);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plantilla de Ticket</h1>
          <p className="text-sm text-muted-foreground">
            Configura el contenido y formato de los tickets de venta impresos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreviewPDF}>
            <Eye className="mr-2 size-4" />
            Vista Previa PDF
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 size-4" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Store Header Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Encabezado de Tienda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Nombre de la Tienda</Label>
              <Input
                id="store-name"
                placeholder="Ej: Calzado Express Centro"
                value={config.storeName}
                onChange={(e) => updateConfig('storeName', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-address">Dirección</Label>
              <Textarea
                id="store-address"
                placeholder="Ej: Av. Principal #123, Col. Centro, CDMX"
                value={config.storeAddress}
                onChange={(e) => updateConfig('storeAddress', e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store-phone">Teléfono</Label>
                <Input
                  id="store-phone"
                  placeholder="(555) 123-4567"
                  value={config.storePhone}
                  onChange={(e) => updateConfig('storePhone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-tax-id">RFC</Label>
                <Input
                  id="store-tax-id"
                  placeholder="XAXX010101000"
                  value={config.storeTaxId}
                  onChange={(e) => updateConfig('storeTaxId', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Print Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Impresión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paper-width">Ancho de Papel</Label>
              <Select
                value={config.paperWidth}
                onValueChange={(val) =>
                  updateConfig('paperWidth', val as PaperWidth)
                }
              >
                <SelectTrigger id="paper-width" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm (32 caracteres)</SelectItem>
                  <SelectItem value="80mm">80mm (48 caracteres)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bluetooth</Label>
              <p className="text-sm text-muted-foreground">
                {isBluetoothSupported
                  ? '✅ Web Bluetooth disponible en este navegador.'
                  : '⚠️ Web Bluetooth no disponible. Se usará generación de PDF como alternativa.'}
              </p>
            </div>

            {/* Toggle sections */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mostrar nombre del vendedor</Label>
                  <p className="text-xs text-muted-foreground">
                    Incluir el nombre del vendedor en el ticket
                  </p>
                </div>
                <Switch
                  checked={config.showSellerName}
                  onCheckedChange={(checked) =>
                    updateConfig('showSellerName', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Mostrar detalle de descuentos</Label>
                  <p className="text-xs text-muted-foreground">
                    Desglosar descuentos por línea
                  </p>
                </div>
                <Switch
                  checked={config.showDiscountDetail}
                  onCheckedChange={(checked) =>
                    updateConfig('showDiscountDetail', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Mostrar política de devolución</Label>
                  <p className="text-xs text-muted-foreground">
                    Incluir texto de política al pie del ticket
                  </p>
                </div>
                <Switch
                  checked={config.showReturnPolicy}
                  onCheckedChange={(checked) =>
                    updateConfig('showReturnPolicy', checked)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Return Policy */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Texto de Política de Devolución</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Ej: Cambios y devoluciones dentro de los 30 días posteriores a la compra con ticket original."
              value={config.returnPolicyText}
              onChange={(e) =>
                updateConfig('returnPolicyText', e.target.value)
              }
              rows={3}
              maxLength={500}
              disabled={!config.showReturnPolicy}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {config.returnPolicyText.length}/500 caracteres
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
