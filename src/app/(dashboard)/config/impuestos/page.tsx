'use client';

/**
 * Tax rate configuration page. Admin only.
 *
 * Allows viewing and understanding the default IVA rate.
 * Tax rates are set per-product; this page shows the default and explains the system.
 *
 * Validates: Requirements 7.4, 8.4
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_TAX_RATE } from '@/lib/constants';

export default function ImpuestosConfigPage() {
  const router = useRouter();
  const { role, hasPermission } = usePermissions();
  const canManage = hasPermission('config.manage');

  useEffect(() => {
    if (role && !canManage) {
      router.replace('/');
    }
  }, [role, canManage, router]);

  if (role && !canManage) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Impuestos</h1>
          <p className="text-sm text-muted-foreground">
            Configuración de tasas de impuesto (IVA) del sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>IVA por Defecto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tasa de IVA predeterminada</span>
              <Badge variant="default" className="text-lg">
                {(DEFAULT_TAX_RATE * 100).toFixed(0)}%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Esta es la tasa de IVA que se aplica por defecto al crear nuevos productos.
              Cada producto puede tener su propia tasa de IVA configurada individualmente
              desde el módulo de catálogo.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cómo funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              El sistema calcula el IVA de la siguiente manera:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Cada producto tiene su propia tasa de IVA (por defecto {(DEFAULT_TAX_RATE * 100).toFixed(0)}%)</li>
              <li>El IVA se calcula sobre el subtotal después de descuentos</li>
              <li>Se usa redondeo ROUND_HALF_UP a 2 decimales</li>
              <li>El total de la venta = subtotal - descuento + IVA</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tasas de IVA en Uso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">IVA General</p>
                  <p className="text-sm text-muted-foreground">
                    Tasa estándar aplicada a la mayoría de productos
                  </p>
                </div>
                <Badge variant="outline" className="text-base">
                  {(DEFAULT_TAX_RATE * 100).toFixed(0)}%
                </Badge>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Para modificar la tasa de IVA de un producto específico, edítelo desde
              Catálogo → Productos → Editar.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
