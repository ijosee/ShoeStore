'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ProductForm } from '@/components/catalog/ProductForm';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Edit product page. Admin only.
 * Pre-fills the ProductForm with existing product data.
 *
 * Validates: Requirements 1.1, 1.2
 */
export default function EditarProductoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission, role } = usePermissions();
  const canEdit = hasPermission('product.edit');
  const productId = params.id;

  // Redirect non-admin users
  useEffect(() => {
    if (role && !canEdit) {
      router.replace(`/catalogo/productos/${productId}`);
    }
  }, [role, canEdit, router, productId]);

  // Fetch product data for pre-filling
  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Error al cargar producto');
      }
      const json = await res.json();
      return json.data;
    },
    enabled: !!productId && canEdit,
  });

  if (!canEdit) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          Volver
        </Button>
        <p className="text-destructive">
          {error instanceof Error
            ? error.message
            : 'Producto no encontrado'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/catalogo/productos/${productId}`)}
        >
          <ArrowLeft className="mr-1 size-4" />
          Detalle
        </Button>
        <h1 className="text-2xl font-bold">Editar Producto</h1>
      </div>

      <ProductForm
        productId={productId}
        initialData={{
          name: product.name,
          brand_id: product.brands?.id ?? '',
          category_id: product.categories?.id ?? '',
          description: product.description ?? '',
          base_price: product.base_price,
          cost: product.cost,
          tax_rate: product.tax_rate,
        }}
        existingImages={
          product.product_images?.map(
            (img: {
              id: string;
              image_url: string;
              thumbnail_url: string | null;
              is_primary: boolean;
            }) => ({
              id: img.id,
              image_url: img.image_url,
              thumbnail_url: img.thumbnail_url,
              is_primary: img.is_primary,
            }),
          ) ?? []
        }
      />
    </div>
  );
}
