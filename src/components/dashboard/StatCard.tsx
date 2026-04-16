'use client';

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface StatCardProps {
  /** Card title / label */
  label: string;
  /** Main value to display */
  value: string | number;
  /** Optional description or trend text */
  description?: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Whether the card is in a loading/skeleton state */
  isLoading?: boolean;
}

/**
 * Reusable stat card widget for the dashboard.
 * Displays an icon, label, value, and optional trend/description.
 *
 * Validates: Requirements 13.1, 13.2
 */
export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  isLoading = false,
}: Readonly<StatCardProps>) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
            {description !== undefined && (
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            )}
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
