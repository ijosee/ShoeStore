/**
 * Zustand store for Bluetooth printer connection state.
 *
 * Manages printer connection status, configuration, and error state.
 * Used by the usePrinter hook and printing subsystem.
 *
 * Validates: Requirements 10.3, 10.4
 */

import { create } from 'zustand';

import type {
  PaperWidth,
  PrinterConfig,
  PrinterConnectionStatus,
  PrinterState,
} from '@/types/printing';
import { PAPER_WIDTH_CHARS } from '@/lib/constants';

// ─── Actions ─────────────────────────────────────────────────────────────────

interface PrinterActions {
  /** Set the connection status. */
  setStatus: (status: PrinterConnectionStatus) => void;
  /** Set the printer configuration after successful connection. */
  setConfig: (config: PrinterConfig) => void;
  /** Set the last error message. */
  setError: (error: string | null) => void;
  /** Update paper width for the current printer. */
  setPaperWidth: (width: PaperWidth) => void;
  /** Reset the store to disconnected state. */
  reset: () => void;
}

export type PrinterStore = PrinterState & PrinterActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: PrinterState = {
  status: 'disconnected',
  config: null,
  last_error: null,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const usePrinterStore = create<PrinterStore>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),

  setConfig: (config) => set({ config, status: 'connected', last_error: null }),

  setError: (error) =>
    set({ last_error: error, status: error ? 'error' : 'disconnected' }),

  setPaperWidth: (width) =>
    set((state) => {
      if (!state.config) return state;
      return {
        config: {
          ...state.config,
          paper_width: width,
          characters_per_line: PAPER_WIDTH_CHARS[width],
        },
      };
    }),

  reset: () => set({ ...initialState }),
}));
