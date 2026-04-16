'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProductForm } from '@/components/catalog/ProductForm';
import { usePermissions } from '@/hooks/usePermissions';
import { useEffect } from 'react';

/**
 * Create product page. Admin only.
 *
 * Validates: Requirements 1.1, 1.2
 */
export default function NuevoProductoPage() {
  const router = useRouter();
  const { hasPermission, role } = usePermissions();
  const canCreate = hasPermission('product.create');

  // Redirect non-admin users
  useEffect(() => {
    if (role && !canCreate) {
      router.replace('/catalogo/productos');
    }
  }, [role, canCreate, router]);

  if (!canCreate) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/catalogo/productos')}
        >
          <ArrowLeft className="mr-1 size-4" />
          Productos
        </Button>
        <h1 className="text-2xl font-bold">Nuevo Producto</h1>
      </div>

      <ProductForm />
    </div>
  );
}
