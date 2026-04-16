'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export interface RecentSale {
  id: string;
  ticket_number: string;
  total: number;
  status: 'completed' | 'voided';
  seller_name: string;
  created_at: string;
}

interface RecentSalesTableProps {
  /** Title for the card */
  readonly title?: string;
  /** Sales data to display */
  readonly sales: RecentSale[];
  /** Whether the data is loading */
  readonly isLoading?: boolean;
}

/**
 * Small table widget showing the 5 most recent sales.
 *
 * Validates: Requirements 13.1, 13.2
 */
export function RecentSalesTable({
  title = 'Últimas 5 ventas',
  sales,
  isLoading = false,
}: RecentSalesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-${i.toString()}`} className="h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        )}
        {!isLoading && sales.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay ventas recientes
          </p>
        )}
        {!isLoading && sales.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-xs">
                    {sale.ticket_number}
                  </TableCell>
                  <TableCell className="text-xs">{sale.seller_name}</TableCell>
                  <TableCell className="text-xs font-medium">
                    ${sale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sale.status === 'completed' ? 'secondary' : 'destructive'
                      }
                    >
                      {sale.status === 'completed' ? 'Completada' : 'Anulada'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

    </Card>
  );
}
