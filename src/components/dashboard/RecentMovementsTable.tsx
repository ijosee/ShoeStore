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
import { MOVEMENT_TYPE_LABELS } from '@/lib/constants';
import type { MovementType } from '@/types/database';

export interface RecentMovement {
  id: string;
  variant_sku: string;
  movement_type: MovementType;
  quantity: number;
  store_name: string;
  created_at: string;
}

interface RecentMovementsTableProps {
  /** Title for the card */
  readonly title?: string;
  /** Movements data to display */
  readonly movements: RecentMovement[];
  /** Whether the data is loading */
  readonly isLoading?: boolean;
}

/**
 * Small table widget showing the 5 most recent stock movements.
 *
 * Validates: Requirements 13.1, 13.2
 */
export function RecentMovementsTable({
  title = 'Últimos 5 movimientos',
  movements,
  isLoading = false,
}: RecentMovementsTableProps) {
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
        {!isLoading && movements.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay movimientos recientes
          </p>
        )}
        {!isLoading && movements.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Tienda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="font-mono text-xs">
                    {movement.variant_sku}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {MOVEMENT_TYPE_LABELS[movement.movement_type] ??
                        movement.movement_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {movement.quantity > 0 ? '+' : ''}
                    {movement.quantity}
                  </TableCell>
                  <TableCell className="text-xs">
                    {movement.store_name}
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
