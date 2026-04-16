/**
 * Hook for stock alert count with polling-based updates.
 *
 * Provides the count of active stock alerts for the AlertBadge component.
 * Uses polling as a simple initial implementation; Supabase Realtime
 * subscription can be added later for instant updates.
 *
 * Validates: Requirements 13.1, 13.2
 */

'use client';

import { useQuery } from '@tanstack/react-query';

import { useStore } from '@/hooks/useStore';

const ALERT_POLL_INTERVAL = 30_000; // 30 seconds

interface AlertsResponse {
  data: Array<{ id: string }>;
}

export function useStockAlerts() {
  const { activeStoreId } = useStore();

  const { data, isLoading } = useQuery<AlertsResponse>({
    queryKey: ['stock-alerts-count', activeStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeStoreId) params.set('store_id', activeStoreId);

      const res = await fetch(`/api/inventory/alerts?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar alertas');
      return res.json();
    },
    refetchInterval: ALERT_POLL_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const alertCount = data?.data?.length ?? 0;

  return {
    /** Number of active stock alerts. */
    alertCount,
    /** Whether the alert count is still loading. */
    isLoading,
  };
}
