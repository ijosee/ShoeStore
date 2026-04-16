/**
 * Unit tests for the Zustand auth store.
 *
 * Tests the store actions: setUser, setActiveStore, clearUser.
 * The initialize action requires Supabase and is tested separately.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import type { AuthUser } from '@/types/permissions';

const mockUser: AuthUser = {
  id: 'user-123',
  email: 'admin@shoestore.com',
  full_name: 'Carlos Admin',
  role: 'admin',
  is_active: true,
  store_ids: ['store-centro', 'store-norte', 'store-sur'],
};

describe('auth-store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      user: null,
      active_store_id: null,
      is_loading: true,
    });
  });

  describe('setUser', () => {
    it('sets the user and selects the first store as active', () => {
      useAuthStore.getState().setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.active_store_id).toBe('store-centro');
      expect(state.is_loading).toBe(false);
    });

    it('sets active_store_id to null when user has no stores', () => {
      const userNoStores: AuthUser = { ...mockUser, store_ids: [] };
      useAuthStore.getState().setUser(userNoStores);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(userNoStores);
      expect(state.active_store_id).toBeNull();
    });
  });

  describe('setActiveStore', () => {
    it('updates the active store id', () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setActiveStore('store-norte');

      expect(useAuthStore.getState().active_store_id).toBe('store-norte');
    });
  });

  describe('clearUser', () => {
    it('clears user and active store, sets loading to false', () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().clearUser();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.active_store_id).toBeNull();
      expect(state.is_loading).toBe(false);
    });
  });

  describe('initial state', () => {
    it('starts with null user, null store, and loading true', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.active_store_id).toBeNull();
      expect(state.is_loading).toBe(true);
    });
  });
});
