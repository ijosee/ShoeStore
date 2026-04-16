/**
 * Hook wrapper for the cart Zustand store.
 *
 * Provides a convenient API for POS components to access cart state and actions.
 *
 * Validates: Requirements 6.5, 6.6, 6.7, 6.8
 */

import { useCartStore } from '@/stores/cart-store';

/**
 * Access the POS cart state and actions.
 *
 * @example
 * const { lines, totals, addLine, clearCart } = useCart();
 */
export function useCart() {
  const lines = useCartStore((s) => s.lines);
  const discount = useCartStore((s) => s.discount);
  const payments = useCartStore((s) => s.payments);
  const totals = useCartStore((s) => s.totals);
  const addLine = useCartStore((s) => s.addLine);
  const removeLine = useCartStore((s) => s.removeLine);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const applyDiscount = useCartStore((s) => s.applyDiscount);
  const removeDiscount = useCartStore((s) => s.removeDiscount);
  const setPayment = useCartStore((s) => s.setPayment);
  const clearCart = useCartStore((s) => s.clearCart);

  return {
    // State
    lines,
    discount,
    payments,
    totals,
    // Actions
    addLine,
    removeLine,
    updateQuantity,
    applyDiscount,
    removeDiscount,
    setPayment,
    clearCart,
  };
}
