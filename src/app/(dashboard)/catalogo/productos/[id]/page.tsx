'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ProductGallery } from '@/components/catalog/ProductGallery';
import { usePermissions } from '@/hooks/usePermissions';
import { formatMXN } from '@/lib/utils/currency';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  cost: number;
  tax_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  brands: { id: string; name: string } | null;
  categories: { id: string; name: string } | null;
  product_images: Array<{
    id: string;
    color: string | null;
    image_url: string;
    thumbnail_url: string | null;
    optimized_url: string | null;
    sort_order: number;
    is_primary: boolean;
  }>;
  product_variants: Array<{
    id: string;
    sku: string;
    barcode: string | null;
    price_override: number | null;
    is_active: boolean;
    sizes: { id: string; value: string; sort_order: number } | null;
    colors: {
      id: string;
      name: string;
      hex_code: string;
      sort_order: number;
    } | null;
    stock_levels: Array<{
      id: string;
      store_id: string;
      quantity: number;
      low_stock_threshold: number;
      stores: { id: string; name: string; code: string } | null;
    }>;
  }>;
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Product detail page with gallery, info, and variants table.
 *
 * Validates: Requirements 1.9, 2.3, 2.4, 2.5
 */
export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('product.edit');

  const productId = params.id;

  const {
    data: product,
    isLoading,
    error,
  } = useQuery<ProductDetail>({
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
    enabled: !!productId,
  });

  // Status toggle mutation
  const statusMutation = useMutation({
    mutationFn: async (newStatus: boolean) => {
      const res = await fetch(`/api/products/${productId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.message ?? 'Error al cambiar estado',
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      toast.success('Estado actualizado');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

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

  const effectivePrice = (variant: ProductDetail['product_variants'][0]) =>
    variant.price_override ?? product.base_price;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/catalogo/productos')}
          >
            <ArrowLeft className="mr-1 size-4" />
            Productos
          </Button>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                statusMutation.mutate(!product.is_active)
              }
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {product.is_active ? 'Desactivar' : 'Activar'}
            </Button>
            <Button
              onClick={() =>
                router.push(`/catalogo/productos/${productId}/editar`)
              }
            >
              <Edit className="mr-2 size-4" />
              Editar
            </Button>
          </div>
        )}
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gallery */}
        <ProductGallery images={product.product_images} />

        {/* Product info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-xl">{product.name}</CardTitle>
              {product.is_active ? (
                <Badge variant="default">Activo</Badge>
              ) : (
                <Badge variant="secondary">Inactivo</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Marca</span>
                <p className="font-medium">
                  {product.brands?.name ?? '—'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Categoría</span>
                <p className="font-medium">
                  {product.categories?.name ?? '—'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Precio base</span>
                <p className="font-medium">
                  {formatMXN(product.base_price)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Costo</span>
                <p className="font-medium">{formatMXN(product.cost)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">IVA</span>
                <p className="font-medium">
                  {(product.tax_rate * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {product.description && (
              <div>
                <span className="text-sm text-muted-foreground">
                  Descripción
                </span>
                <p className="mt-1 text-sm">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Variants table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Variantes ({product.product_variants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Talla</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Código de barras</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock por tienda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.product_variants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-16 text-center text-muted-foreground"
                    >
                      Sin variantes
                    </TableCell>
                  </TableRow>
                ) : (
                  product.product_variants.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell>
                        {variant.sizes?.value ?? '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {variant.colors?.hex_code && (
                            <span
                              className="inline-block size-3 rounded-full border"
                              style={{
                                backgroundColor:
                                  variant.colors.hex_code,
                              }}
                            />
                          )}
                          {variant.colors?.name ?? '—'}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {variant.sku}
                      </TableCell>
                      <TableCell>
                        {variant.barcode ?? (
                          <span className="text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatMXN(effectivePrice(variant))}
                        {variant.price_override !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (especial)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {variant.stock_levels.length === 0 ? (
                          <span className="text-muted-foreground">
                            Sin stock
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {variant.stock_levels.map((sl) => (
                              <span
                                key={sl.id}
                                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
                              >
                                <span className="font-medium">
                                  {sl.stores?.code ?? '?'}
                                </span>
                                <span
                                  className={
                                    sl.quantity <= sl.low_stock_threshold
                                      ? 'text-destructive'
                                      : ''
                                  }
                                >
                                  {sl.quantity}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
