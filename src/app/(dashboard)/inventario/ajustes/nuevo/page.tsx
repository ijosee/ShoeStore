'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdjustmentForm } from '@/components/inventory/AdjustmentForm';
import { usePermissions } from '@/hooks/usePermissions';
import { useStore } from '@/hooks/useStore';

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * New stock adjustment page. Manager/Admin only.
 *
 * Validates: Requirements 3.8
 */
export default function NuevoAjustePage() {
  const router = useRouter();
  const { hasPermission, role } = usePermissions();
  const { activeStoreId } = useStore();
  const canAdjust = hasPermission('stock.adjust');

  // Redirect unauthorized users
  useEffect(() => {
    if (role && !canAdjust) {
      router.replace('/');
    }
  }, [role, canAdjust, router]);

  if (role && !canAdjust) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo Ajuste de Stock</h1>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Ajuste de Inventario</CardTitle>
          <CardDescription>
            Busque la variante, ingrese la cantidad real y documente el motivo del ajuste.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdjustmentForm
            storeId={activeStoreId}
            onSuccess={() => router.push('/inventario/stock')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
