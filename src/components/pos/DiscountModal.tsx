'use client';

/**
 * Modal for applying discounts: percentage or fixed amount, at cart level.
 *
 * Validates: Requirements 6.7
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/hooks/useCart';
import type { DiscountType } from '@/types/database';

interface DiscountModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function DiscountModal({ open, onOpenChange }: DiscountModalProps) {
  const { applyDiscount } = useCart();
  const [type, setType] = useState<DiscountType>('percentage');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleApply = () => {
    const numValue = Number.parseFloat(value);

    if (Number.isNaN(numValue) || numValue <= 0) {
      setError('Ingresa un valor mayor a 0');
      return;
    }

    if (type === 'percentage' && numValue > 100) {
      setError('El porcentaje no puede ser mayor a 100%');
      return;
    }

    applyDiscount({ type, value: numValue });
    handleClose();
  };

  const handleClose = () => {
    setValue('');
    setError('');
    setType('percentage');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Aplicar Descuento</DialogTitle>
          <DialogDescription>
            Selecciona el tipo de descuento y el valor a aplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Discount type toggle */}
          <div className="flex gap-2">
            <Button
              variant={type === 'percentage' ? 'default' : 'outline'}
              onClick={() => {
                setType('percentage');
                setError('');
              }}
              className="flex-1"
            >
              Porcentaje (%)
            </Button>
            <Button
              variant={type === 'fixed_amount' ? 'default' : 'outline'}
              onClick={() => {
                setType('fixed_amount');
                setError('');
              }}
              className="flex-1"
            >
              Monto Fijo ($)
            </Button>
          </div>

          {/* Value input */}
          <div className="space-y-2">
            <Label htmlFor="discount-value">
              {type === 'percentage' ? 'Porcentaje (0-100)' : 'Monto en MXN'}
            </Label>
            <Input
              id="discount-value"
              type="number"
              min="0"
              max={type === 'percentage' ? '100' : undefined}
              step={type === 'percentage' ? '1' : '0.01'}
              placeholder={type === 'percentage' ? 'Ej: 10' : 'Ej: 100.00'}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply();
              }}
              aria-invalid={!!error}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
