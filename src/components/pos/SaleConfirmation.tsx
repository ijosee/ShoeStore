'use client';

/**
 * Post-sale confirmation modal showing ticket number, total, payment method,
 * reprint option, and "Nueva Venta" button.
 *
 * Validates: Requirements 6.9, 6.10, 6.11
 */

import { CheckCircle, Printer, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatMXN } from '@/lib/utils/currency';

export interface SaleResult {
  id: string;
  ticket_number: string;
  total: number;
  payment_method_name: string;
}

interface SaleConfirmationProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly sale: SaleResult | null;
  readonly onNewSale: () => void;
  readonly onPrintTicket?: () => void;
}

export function SaleConfirmation({
  open,
  onOpenChange,
  sale,
  onNewSale,
  onPrintTicket,
}: SaleConfirmationProps) {
  if (!sale) return null;

  const handleNewSale = () => {
    onNewSale();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="size-6 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-center">¡Venta Exitosa!</DialogTitle>
          <DialogDescription className="text-center">
            La venta se ha registrado correctamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ticket</span>
            <span className="font-mono font-semibold">{sale.ticket_number}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{formatMXN(sale.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Método de Pago</span>
            <span>{sale.payment_method_name}</span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleNewSale} className="w-full" size="lg">
            <ShoppingCart className="mr-1.5 size-4" />
            Nueva Venta
          </Button>
          <Button
            variant="outline"
            onClick={onPrintTicket}
            className="w-full"
          >
            <Printer className="mr-1.5 size-4" />
            Imprimir Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
