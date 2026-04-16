/**
 * Hook for accessing printer state and actions.
 *
 * Wraps the printer Zustand store and BluetoothPrinterManager
 * to provide a simple interface for connecting, printing, and
 * managing the Bluetooth thermal printer.
 *
 * Validates: Requirements 10.3, 10.4
 */

'use client';

import { useCallback, useRef } from 'react';

import type { PaperWidth, TicketData } from '@/types/printing';
import { PAPER_WIDTH_CHARS } from '@/lib/constants';
import { BluetoothPrinterManager } from '@/lib/printing/bluetooth-manager';
import { buildTicket } from '@/lib/printing/escpos-builder';
import { generateTicketPDF } from '@/lib/printing/pdf-fallback';
import { usePrinterStore } from '@/stores/printer-store';

export function usePrinter() {
  const store = usePrinterStore();
  const managerRef = useRef<BluetoothPrinterManager | null>(null);

  /** Get or create the Bluetooth manager singleton. */
  const getManager = useCallback(() => {
    if (!managerRef.current) {
      managerRef.current = new BluetoothPrinterManager();
      managerRef.current.onEvent((event, detail) => {
        switch (event) {
          case 'connected':
            // Config is set in the connect() callback below
            break;
          case 'disconnected':
            store.reset();
            break;
          case 'error':
            store.setError(detail ?? 'Error de conexión');
            break;
        }
      });
    }
    return managerRef.current;
  }, [store]);

  /** Check if Web Bluetooth is supported. */
  const isBluetoothSupported = BluetoothPrinterManager.isSupported();

  /** Connect to a Bluetooth printer. Opens the browser device picker. */
  const connect = useCallback(
    async (paperWidth: PaperWidth = '80mm') => {
      const manager = getManager();
      store.setStatus('connecting');

      try {
        const info = await manager.connect();
        store.setConfig({
          id: info.id,
          name: info.name,
          paper_width: paperWidth,
          characters_per_line: PAPER_WIDTH_CHARS[paperWidth],
          is_default: true,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al conectar';
        store.setError(message);
        throw err;
      }
    },
    [getManager, store],
  );

  /** Disconnect from the current printer. */
  const disconnect = useCallback(() => {
    managerRef.current?.disconnect();
    store.reset();
  }, [store]);

  /** Print a ticket via Bluetooth. */
  const printTicket = useCallback(
    async (data: TicketData) => {
      const manager = getManager();
      if (!manager.isConnected()) {
        throw new Error('Impresora no conectada');
      }

      const paperWidth = store.config?.paper_width ?? '80mm';
      const bytes = buildTicket(data, paperWidth);
      await manager.print(bytes);
    },
    [getManager, store.config?.paper_width],
  );

  /** Print raw ESC/POS bytes via Bluetooth. */
  const printRaw = useCallback(
    async (data: Uint8Array) => {
      const manager = getManager();
      if (!manager.isConnected()) {
        throw new Error('Impresora no conectada');
      }
      await manager.print(data);
    },
    [getManager],
  );

  /** Generate and download a PDF ticket as fallback. */
  const downloadPDF = useCallback((data: TicketData, filename?: string) => {
    const blob = generateTicketPDF(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `ticket-${data.ticket_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    // State
    status: store.status,
    config: store.config,
    lastError: store.last_error,
    isConnected: store.status === 'connected',
    isBluetoothSupported,

    // Actions
    connect,
    disconnect,
    printTicket,
    printRaw,
    downloadPDF,
    setPaperWidth: store.setPaperWidth,
  };
}
