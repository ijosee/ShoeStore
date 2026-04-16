'use client';

/**
 * POS (Point of Sale) main page.
 *
 * Two-column layout: left (60%) for search/products, right (40%) for cart.
 * On mobile: uses Tabs to switch between "Productos" and "Carrito".
 *
 * States: empty cart, processing sale, sale success, stock error, print error.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 7.1, 7.2, 7.3
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cart } from '@/components/pos/Cart';
import { DiscountModal } from '@/components/pos/DiscountModal';
import {
  PaymentSelector,
  type PaymentEntry,
} from '@/components/pos/PaymentSelector';
import { SearchBar } from '@/components/pos/SearchBar';
import {
  SaleConfirmation,
  type SaleResult,
} from '@/components/pos/SaleConfirmation';
import type { POSSearchResult } from '@/components/pos/ProductCard';
import { useCart } from '@/hooks/useCart';
import { usePrinter } from '@/hooks/usePrinter';
import { useStore } from '@/hooks/useStore';
import { saleToTicketData, downloadTicketPDF } from '@/lib/printing/print-service';
import type { TicketData } from '@/types/printing';

export default function POSPage() {
  const { activeStoreId } = useStore();
  const { lines, totals, discount, addLine, setPayment, clearCart } = useCart();
  const { isConnected, printTicket, isBluetoothSupported } = usePrinter();

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [lastTicketData, setLastTicketData] = useState<TicketData | null>(null);

  // Add product to cart from search
  const handleAddProduct = useCallback(
    (product: POSSearchResult) => {
      addLine({
        id: crypto.randomUUID(),
        variant_id: product.variant_id,
        product_name: product.product_name,
        variant_description: [product.size, product.color]
          .filter(Boolean)
          .join(' - '),
        sku: product.sku,
        image_url: product.image_url,
        size: product.size ?? '',
        color: product.color ?? '',
        quantity: 1,
        max_stock: product.stock,
        unit_price: product.price,
        tax_rate: product.tax_rate,
        line_discount: 0,
      });
      toast.success(`${product.product_name} agregado al carrito`);
    },
    [addLine],
  );

  // Open payment selector
  const handleConfirmSale = useCallback(() => {
    if (lines.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }
    setPaymentOpen(true);
  }, [lines.length]);

  // Process sale after payment selection
  const handlePaymentConfirm = useCallback(
    async (payments: PaymentEntry[]) => {
      if (!activeStoreId) {
        toast.error('No hay tienda activa seleccionada');
        return;
      }

      setIsProcessing(true);
      setPaymentOpen(false);

      try {
        // Set payments in cart store
        setPayment(
          payments.map((p) => ({
            payment_method_id: p.payment_method_id,
            payment_method_name: p.payment_method_name,
            amount: p.amount,
            amount_received: p.amount_received,
          })),
        );

        // Build request body
        const body = {
          store_id: activeStoreId,
          lines: lines.map((line) => ({
            variant_id: line.variant_id,
            quantity: line.quantity,
            unit_price: line.unit_price,
            line_discount: line.line_discount,
          })),
          discount: discount
            ? { type: discount.type, value: discount.value }
            : undefined,
          payments: payments.map((p) => ({
            payment_method_id: p.payment_method_id,
            amount: p.amount,
          })),
        };

        const res = await fetch('/api/sales/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const json = await res.json();

        if (!res.ok) {
          const errorCode = json.error?.code;
          if (errorCode === 'STOCK_INSUFFICIENT') {
            toast.error('Stock insuficiente', {
              description:
                json.error?.message ??
                'Uno o más productos no tienen stock suficiente. Ajusta el carrito.',
            });
          } else if (errorCode === 'PAYMENT_MISMATCH') {
            toast.error('Error de pago', {
              description:
                json.error?.message ??
                'La suma de pagos no coincide con el total.',
            });
          } else {
            toast.error('Error al confirmar venta', {
              description: json.error?.message ?? 'Intenta de nuevo.',
            });
          }
          return;
        }

        // Sale successful
        const sale = json.data;
        setSaleResult({
          id: sale.id,
          ticket_number: sale.ticket_number,
          total: sale.total,
          payment_method_name: payments[0]?.payment_method_name ?? '',
        });
        setConfirmationOpen(true);

        // Build ticket data for printing
        const ticketData = saleToTicketData(sale);
        setLastTicketData(ticketData);

        // Auto-print if Bluetooth printer is connected
        if (isConnected) {
          try {
            await printTicket(ticketData);
            toast.success('Ticket enviado a la impresora');
          } catch {
            toast.warning('No se pudo imprimir el ticket', {
              description: 'Puedes reimprimirlo desde el diálogo de confirmación.',
            });
          }
        }
      } catch {
        toast.error('Error de conexión', {
          description: 'No se pudo conectar con el servidor.',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [activeStoreId, lines, discount, setPayment],
  );

  // Start new sale
  const handleNewSale = useCallback(() => {
    clearCart();
    setSaleResult(null);
    setLastTicketData(null);
    setConfirmationOpen(false);
  }, [clearCart]);

  // Cancel current sale
  const handleCancel = useCallback(() => {
    if (lines.length === 0) return;
    clearCart();
    toast.info('Venta cancelada');
  }, [lines.length, clearCart]);

  // Print ticket (reprint from confirmation dialog)
  const handlePrintTicket = useCallback(async () => {
    if (!lastTicketData) {
      toast.error('No hay datos de ticket disponibles');
      return;
    }

    if (isConnected) {
      try {
        await printTicket(lastTicketData);
        toast.success('Ticket enviado a la impresora');
      } catch {
        toast.error('Error al imprimir. Descargando PDF como alternativa.');
        downloadTicketPDF(lastTicketData);
      }
    } else {
      // Fallback to PDF download
      downloadTicketPDF(lastTicketData);
      toast.success('PDF del ticket descargado');
    }
  }, [lastTicketData, isConnected, printTicket]);

  const cartItemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Punto de Venta</h1>
        {cartItemCount > 0 && (
          <Badge variant="secondary" className="md:hidden">
            {cartItemCount} {cartItemCount === 1 ? 'artículo' : 'artículos'}
          </Badge>
        )}
      </div>

      {/* Mobile: Tabs layout */}
      <div className="flex flex-1 flex-col overflow-hidden md:hidden">
        <Tabs defaultValue="productos" className="flex flex-1 flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="productos" className="flex-1">
              Productos
            </TabsTrigger>
            <TabsTrigger value="carrito" className="flex-1">
              Carrito
              {cartItemCount > 0 && (
                <Badge variant="default" className="ml-1.5">
                  {cartItemCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="productos" className="flex-1 overflow-y-auto pt-3">
            <SearchBar
              onAddProduct={handleAddProduct}
            />
          </TabsContent>
          <TabsContent value="carrito" className="flex flex-1 flex-col overflow-hidden pt-3">
            <Cart
              onApplyDiscount={() => setDiscountOpen(true)}
              onConfirmSale={handleConfirmSale}
              onCancel={handleCancel}
              isProcessing={isProcessing}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop/Tablet: Two-column layout (60/40) */}
      <div className="hidden flex-1 gap-4 overflow-hidden md:flex">
        {/* Left column: Search & Products (60%) */}
        <div className="flex w-3/5 flex-col overflow-y-auto">
          <SearchBar
            onAddProduct={handleAddProduct}
          />
        </div>

        {/* Right column: Cart (40%) */}
        <div className="flex w-2/5 flex-col overflow-hidden rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Carrito
            {cartItemCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {cartItemCount}
              </Badge>
            )}
          </h2>
          <Cart
            onApplyDiscount={() => setDiscountOpen(true)}
            onConfirmSale={handleConfirmSale}
            onCancel={handleCancel}
            isProcessing={isProcessing}
          />
        </div>
      </div>

      {/* Modals */}
      <DiscountModal open={discountOpen} onOpenChange={setDiscountOpen} />
      <PaymentSelector
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={totals.total}
        onConfirm={handlePaymentConfirm}
        isProcessing={isProcessing}
      />
      <SaleConfirmation
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        sale={saleResult}
        onNewSale={handleNewSale}
        onPrintTicket={handlePrintTicket}
      />
    </div>
  );
}
