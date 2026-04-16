'use client';

import { useEffect, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStore } from '@/hooks/useStore';
import { useAuthStore } from '@/stores/auth-store';
import type { Store } from '@/types/database';

/**
 * Dropdown to switch the active store.
 *
 * - Admin sees all stores.
 * - Gerente / Vendedor sees only their assigned stores.
 *
 * Validates: Requirements 11.6
 */
export function StoreSelector() {
  const { activeStoreId, storeIds, setActiveStore } = useStore();
  const role = useAuthStore((s) => s.user?.role ?? null);
  const [stores, setStores] = useState<Pick<Store, 'id' | 'name'>[]>([]);

  useEffect(() => {
    async function fetchStores() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        let query = supabase
          .from('stores')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        // Non-admin users only see their assigned stores
        if (role !== 'admin' && storeIds.length > 0) {
          query = query.in('id', storeIds);
        }

        const { data } = await query;
        if (data) setStores(data);
      } catch {
        // Silently fail — the selector will just be empty
      }
    }

    fetchStores();
  }, [role, storeIds]);

  if (stores.length <= 1) {
    // If only one store, show it as plain text
    const storeName = stores[0]?.name ?? 'Cargando...';
    return (
      <span className="text-sm font-medium truncate max-w-[200px]">
        {storeName}
      </span>
    );
  }

  return (
    <Select
      value={activeStoreId ?? undefined}
      onValueChange={(value) => {
        if (value) setActiveStore(value);
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Seleccionar tienda">
          {(value: string) => {
            if (!value) return 'Seleccionar tienda';
            return stores.find((s) => s.id === value)?.name ?? value;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id} label={store.name}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
