'use client';

/**
 * Payment method selector with toggle buttons, cash amount received input,
 * and change calculation.
 *
 * Fetches payment methods from Supabase. For "Efectivo" shows amount received
 * input and calculates change.
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

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
import { createClient } from '@/lib/supabase/client';
import { formatMXN } from '@/lib/utils/currency';
import type { PaymentMethod } from '@/types/database';

interface PaymentSelectorProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly total: number;
  readonly onConfirm: (payments: PaymentEntry[]) => void;
  readonly isProcessing?: boolean;
}

export interface PaymentEntry {
  payment_method_id: string;
  payment_method_name: string;
  amount: number;
  amount_received: number | null;
}

async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

const CASH_NAMES = new Set(['efectivo', 'cash']);

function isCashMethod(name: string): boolean {
  return CASH_NAMES.has(name.toLowerCase());
}

export function PaymentSelector({
  open,
  onOpenChange,
  total,
  onConfirm,
  isProcessing = false,
}: PaymentSelectorProps) {
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [amountReceived, setAmountReceived] = useState('');
  const [error, setError] = useState('');

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: fetchPaymentMethods,
    staleTime: 5 * 60 * 1000,
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedMethodId(null);
      setAmountReceived('');
      setError('');
    }
  }, [open]);

  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const isCash = selectedMethod ? isCashMethod(selectedMethod.name) : false;
  const receivedNum = Number.parseFloat(amountReceived) || 0;
  const change = isCash ? Math.max(0, receivedNum - total) : 0;

  const handleConfirm = () => {
    if (!selectedMethodId || !selectedMethod) {
      setError('Selecciona un método de pago');
      return;
    }

    if (isCash && receivedNum < total) {
      setError('El monto recibido debe ser igual o mayor al total');
      return;
    }

    const payment: PaymentEntry = {
      payment_method_id: selectedMethodId,
      payment_method_name: selectedMethod.name,
      amount: total,
      amount_received: isCash ? receivedNum : null,
    };

    onConfirm([payment]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Método de Pago</DialogTitle>
          <DialogDescription>
            Total a cobrar: <strong>{formatMXN(total)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment method toggle buttons */}
          <div className="grid grid-cols-2 gap-2">
            {methods.map((method) => (
              <Button
                key={method.id}
                variant={selectedMethodId === method.id ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedMethodId(method.id);
                  setError('');
                  setAmountReceived('');
                }}
                className="w-full"
              >
                {method.name}
              </Button>
            ))}
          </div>

          {/* Cash: amount received + change */}
          {isCash && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="amount-received">Monto Recibido</Label>
                <Input
                  id="amount-received"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Ej: 2500.00"
                  value={amountReceived}
                  onChange={(e) => {
                    setAmountReceived(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                  }}
                  aria-invalid={!!error}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cambio:</span>
                <span className="font-bold text-lg">
                  {formatMXN(change)}
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedMethodId || isProcessing}
          >
            {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
