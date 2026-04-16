/**
 * Types for the ticket printing subsystem (ESC/POS + PDF fallback).
 */

/** Store information printed on the ticket header. */
export interface TicketStoreInfo {
  name: string;
  address: string;
  phone: string;
  tax_id: string;
  logo_url?: string;
  return_policy_text?: string;
}

/** A single line on the printed ticket. */
export interface TicketLine {
  product_name: string;
  variant: string;
  quantity: number;
  unit_price: number;
  line_discount: number;
  line_total: number;
}

/** Payment info printed on the ticket. */
export interface TicketPayment {
  method: string;
  amount: number;
  received?: number;
  change?: number;
}

/** Full data needed to render a sale ticket. */
export interface TicketData {
  store: TicketStoreInfo;
  ticket_number: string;
  seller_name: string;
  lines: TicketLine[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payments: TicketPayment[];
  created_at: string;
}

/** Printer paper width options. */
export type PaperWidth = '58mm' | '80mm';

/** Configuration for a connected thermal printer. */
export interface PrinterConfig {
  id: string;
  name: string;
  paper_width: PaperWidth;
  /** Characters per line (32 for 58mm, 48 for 80mm). */
  characters_per_line: number;
  is_default: boolean;
}

/** Connection status of the Bluetooth printer. */
export type PrinterConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/** State managed by the printer Zustand store. */
export interface PrinterState {
  status: PrinterConnectionStatus;
  config: PrinterConfig | null;
  last_error: string | null;
}
