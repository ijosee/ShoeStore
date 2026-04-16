'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ProductImage {
  id: string;
  image_url: string;
  thumbnail_url: string | null;
  optimized_url: string | null;
  sort_order: number;
  is_primary: boolean;
  color: string | null;
}

interface ProductGalleryProps {
  images: ProductImage[];
}

/**
 * Image gallery for product detail page.
 * Shows a main image with a thumbnail strip for navigation.
 *
 * Validates: Requirements 1.3, 1.9
 */
export function ProductGallery({ images }: ProductGalleryProps) {
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (sorted.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted">
        <span className="text-sm text-muted-foreground">Sin imágenes</span>
      </div>
    );
  }

  const mainImage = sorted[selectedIndex];
  const mainSrc = mainImage?.optimized_url ?? mainImage?.image_url ?? '';

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
        <img
          src={mainSrc}
          alt={`Imagen ${selectedIndex + 1}`}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Thumbnail strip */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, idx) => {
            const thumbSrc = img.thumbnail_url ?? img.image_url;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  'relative size-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                  idx === selectedIndex
                    ? 'border-primary'
                    : 'border-transparent hover:border-muted-foreground/30',
                )}
                aria-label={`Ver imagen ${idx + 1}`}
              >
                <img
                  src={thumbSrc}
                  alt={`Miniatura ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
