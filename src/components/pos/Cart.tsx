'use client';

/**
 * Cart component with list of CartLine items, totals summary, and action buttons.
 *
 * Validates: Requirements 6.5, 6.6, 6.7, 6.8
 */

import { ShoppingCart, Tag, CreditCard, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CartLine } from '@/components/pos/CartLine';
import { formatMXN } from '@/lib/utils/currency';
import { useCart } from '@/hooks/useCart';

interface CartProps {
  readonly onApplyDiscount: () => void;
  readonly onConfirmSale: () => void;
  readonly onCancel: () => void;
  readonly isProcessing?: boolean;
}

export function Cart({
  onApplyDiscount,
  onConfirmSale,
  onCancel,
  isProcessing = false,
}: CartProps) {
  const { lines, discount, totals, updateQuantity, removeLine, removeDiscount } =
    useCart();

  if (lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <ShoppingCart className="size-12" />
        <p className="text-sm">El carrito está vacío</p>
        <p className="text-xs">Busca productos para agregarlos</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Cart lines */}
      <div className="flex-1 overflow-y-auto">
        {lines.map((line) => (
          <CartLine
            key={line.id}
            line={line}
            onUpdateQuantity={updateQuantity}
            onRemove={removeLine}
          />
        ))}
      </div>

      {/* Discount indicator */}
      {discount && (
        <div className="flex items-center justify-between border-t px-1 py-2 text-sm">
          <span className="text-muted-foreground">
            Descuento ({discount.type === 'percentage' ? `${discount.value}%` : formatMXN(discount.value)})
          </span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-destructive">
              -{formatMXN(totals.discount_amount)}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={removeDiscount}
              aria-label="Quitar descuento"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Totals summary */}
      <div className="space-y-1 border-t pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatMXN(totals.subtotal)}</span>
        </div>
        {totals.discount_amount > 0 && !discount && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Descuento</span>
            <span className="text-destructive">-{formatMXN(totals.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">IVA</span>
          <span>{formatMXN(totals.tax_amount)}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{formatMXN(totals.total)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-col gap-2">
        <Button
          onClick={onConfirmSale}
          disabled={isProcessing}
          className="w-full"
          size="lg"
        >
          <CreditCard className="mr-1.5 size-4" />
          {isProcessing ? 'Procesando...' : 'Confirmar Venta'}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onApplyDiscount}
            disabled={isProcessing}
            className="flex-1"
          >
            <Tag className="mr-1.5 size-4" />
            Descuento
          </Button>
          <Button
            variant="destructive"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
