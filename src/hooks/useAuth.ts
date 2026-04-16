/**
 * Hook to access authentication state and actions.
 *
 * Simple wrapper around the Zustand auth store.
 * Validates: Requirements 11.1
 */

import { useAuthStore } from '@/stores/auth-store';

export function useAuth() {
  return useAuthStore();
}
