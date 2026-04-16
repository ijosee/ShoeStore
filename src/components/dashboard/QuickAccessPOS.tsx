'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Large card with a link to the POS module.
 * Displayed for sellers as a quick-access widget.
 *
 * Validates: Requirements 13.1, 13.2
 */
export function QuickAccessPOS() {
  return (
    <Link href="/pos" className="block">
      <Card className="cursor-pointer transition-colors hover:bg-accent">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <ShoppingCart className="size-8 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold">Punto de Venta</h3>
            <p className="text-sm text-muted-foreground">
              Iniciar nueva venta
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
