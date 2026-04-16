'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

interface AlertBadgeProps {
  /** Override the alert count (useful for testing). Defaults to 0. */
  count?: number;
}

/**
 * Bell icon with a count badge showing active stock alerts.
 * Links to /inventario/alertas.
 *
 * For now uses a static count. Supabase Realtime subscription
 * will be wired in a later task.
 *
 * Validates: Requirements 13.2
 */
export function AlertBadge({ count = 0 }: Readonly<AlertBadgeProps>) {
  return (
    <Link
      href="/inventario/alertas"
      aria-label="Alertas de stock"
      className="relative inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Bell className="size-5" />
      {count > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center p-0 text-[10px]"
        >
          {count > 99 ? '99+' : count}
        </Badge>
      )}
    </Link>
  );
}
