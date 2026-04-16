'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TransferForm } from '@/components/inventory/TransferForm';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * New transfer page. Manager/Admin only.
 *
 * Validates: Requirements 4.1, 4.2
 */
export default function NuevaTransferenciaPage() {
  const router = useRouter();
  const { hasPermission, role } = usePermissions();
  const canTransfer = hasPermission('transfer.create');

  // Redirect unauthorized users
  useEffect(() => {
    if (role && !canTransfer) {
      router.replace('/');
    }
  }, [role, canTransfer, router]);

  if (role && !canTransfer) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva Transferencia</h1>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Transferencia entre Tiendas</CardTitle>
          <CardDescription>
            Seleccione las tiendas de origen y destino, agregue las variantes a transferir y confirme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransferForm
            onSuccess={() => router.push('/inventario/transferencias')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
