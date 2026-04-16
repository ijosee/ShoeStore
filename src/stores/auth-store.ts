/**
 * Zustand store for authentication state management.
 *
 * Manages user session, profile, role, and assigned stores.
 * Validates: Requirements 11.1, 11.3
 */

import { create } from 'zustand';

import type { AuthState, AuthUser } from '@/types/permissions';

interface AuthActions {
  /** Set the authenticated user profile. */
  setUser: (user: AuthUser) => void;
  /** Set the currently active store for multi-store users. */
  setActiveStore: (storeId: string) => void;
  /** Clear user session (logout). */
  clearUser: () => void;
  /** Initialize auth state by fetching user profile from Supabase. */
  initialize: () => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  active_store_id: null,
  is_loading: true,
};

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,

  setUser: (user) => {
    set({
      user,
      active_store_id: user.store_ids[0] ?? null,
      is_loading: false,
    });
  },

  setActiveStore: (storeId) => {
    set({ active_store_id: storeId });
  },

  clearUser: () => {
    set({ user: null, active_store_id: null, is_loading: false });
  },

  initialize: async () => {
    set({ is_loading: true });

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        set({ user: null, active_store_id: null, is_loading: false });
        return;
      }

      // Fetch user profile from the users table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, email, full_name, role, is_active')
        .eq('id', authUser.id)
        .single();

      if (profileError || !profile) {
        set({ user: null, active_store_id: null, is_loading: false });
        return;
      }

      // Fetch store assignments from user_stores
      const { data: userStores, error: storesError } = await supabase
        .from('user_stores')
        .select('store_id')
        .eq('user_id', authUser.id);

      if (storesError) {
        set({ user: null, active_store_id: null, is_loading: false });
        return;
      }

      const storeIds = (userStores ?? []).map((us) => us.store_id);

      const authUserProfile: AuthUser = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        is_active: profile.is_active,
        store_ids: storeIds,
      };

      set({
        user: authUserProfile,
        active_store_id: storeIds[0] ?? null,
        is_loading: false,
      });
    } catch {
      set({ user: null, active_store_id: null, is_loading: false });
    }
  },
}));
