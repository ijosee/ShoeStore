/**
 * Hook to manage the active store for the current user.
 *
 * Provides the active store ID, the list of assigned store IDs,
 * and a function to switch the active store.
 *
 * Validates: Requirements 11.6
 */

'use client';

import { useCallback } from 'react';

import { useAuthStore } from '@/stores/auth-store';

export function useStore() {
  const activeStoreId = useAuthStore((state) => state.active_store_id);
  const storeIds = useAuthStore((state) => state.user?.store_ids ?? []);
  const setActiveStoreAction = useAuthStore((state) => state.setActiveStore);

  const setActiveStore = useCallback(
    (storeId: string) => {
      setActiveStoreAction(storeId);
    },
    [setActiveStoreAction],
  );

  return {
    /** The currently selected store ID, or null if none. */
    activeStoreId,
    /** All store IDs assigned to the current user. */
    storeIds,
    /** Switch the active store. */
    setActiveStore,
  };
}
