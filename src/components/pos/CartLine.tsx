'use client';

/**
 * Individual cart line item with quantity controls, price, subtotal, and delete button.
 *
 * Validates: Requirements 6.5, 6.6
 */

import { Minus, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatMXN } from '@/lib/utils/currency';
import type { CartLine as CartLineType } from '@/types/cart';

interface CartLineProps {
  readonly line: CartLineType;
  readonly onUpdateQuantity: (lineId: string, quantity: number) => void;
  readonly onRemove: (lineId: string) => void;
}

export function CartLine({ line, onUpdateQuantity, onRemove }: CartLineProps) {
  const lineSubtotal = line.unit_price * line.quantity;

  return (
    <div className="flex items-center gap-2 border-b py-2 last:border-b-0">
      {/* Product info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{line.product_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {line.variant_description}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatMXN(line.unit_price)} c/u
        </p>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onUpdateQuantity(line.id, line.quantity - 1)}
          disabled={line.quantity <= 1}
          aria-label="Disminuir cantidad"
        >
          <Minus />
        </Button>
        <span className="w-8 text-center text-sm font-medium">
          {line.quantity}
        </span>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onUpdateQuantity(line.id, line.quantity + 1)}
          disabled={line.quantity >= line.max_stock}
          aria-label="Aumentar cantidad"
        >
          <Plus />
        </Button>
      </div>

      {/* Subtotal */}
      <span className="w-20 text-right text-sm font-semibold">
        {formatMXN(lineSubtotal)}
      </span>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onRemove(line.id)}
        aria-label={`Eliminar ${line.product_name}`}
      >
        <X className="text-destructive" />
      </Button>
    </div>
  );
}
