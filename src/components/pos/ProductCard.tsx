'use client';

/**
 * Compact product card for POS search results.
 *
 * Displays thumbnail, product name, variant (size-color), price, and stock badge.
 * Click to add to cart via useCart.addLine.
 *
 * Validates: Requirements 6.2, 6.4, 6.5
 */

import { Package } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatMXN } from '@/lib/utils/currency';

export interface POSSearchResult {
  variant_id: string;
  product_name: string;
  size: string | null;
  color: string | null;
  sku: string;
  barcode: string | null;
  price: number;
  tax_rate: number;
  stock: number;
  image_url: string | null;
}

interface ProductCardProps {
  readonly product: POSSearchResult;
  readonly onAdd: (product: POSSearchResult) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const variantLabel = [product.size, product.color].filter(Boolean).join(' - ');

  return (
    <Card
      size="sm"
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onAdd(product)}
      role="button"
      tabIndex={0}
      aria-label={`Agregar ${product.product_name} ${variantLabel} al carrito`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAdd(product);
        }
      }}
    >
      <CardContent className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.product_name}
              className="size-full object-cover"
            />
          ) : (
            <Package className="size-6 text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{product.product_name}</p>
          {variantLabel && (
            <p className="truncate text-xs text-muted-foreground">{variantLabel}</p>
          )}
          <p className="text-xs text-muted-foreground">{product.sku}</p>
        </div>

        {/* Price & Stock */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold">{formatMXN(product.price)}</span>
          <Badge
            variant={product.stock <= 3 ? 'destructive' : 'secondary'}
          >
            {product.stock} disp.
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
