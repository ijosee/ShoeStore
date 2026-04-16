/**
 * High-level printing service that orchestrates ticket printing.
 *
 * Handles the print flow: try Bluetooth → fallback to PDF → show error.
 * Used by the POS, sale detail, and return pages.
 *
 * Validates: Requirements 10.3, 10.4, 10.5
 */

import type { PaperWidth, TicketData } from '@/types/printing';
import { buildReturnNoteLayout } from './ticket-template';
import { ESCPOSBuilder, type PrintInstruction } from './escpos-builder';
import { generateTicketPDF, generateReturnNotePDF } from './pdf-fallback';

export type PrintResult =
  | { success: true; method: 'bluetooth' | 'pdf' }
  | { success: false; error: string };

/**
 * Apply a single text instruction to the builder.
 */
function applyTextInstruction(
  builder: ESCPOSBuilder,
  instr: PrintInstruction & { type: 'text' },
): void {
  if (instr.size) builder.size(instr.size);
  if (instr.align) builder.align(instr.align);
  if (instr.bold) builder.bold(true);
  builder.writeLine(instr.content);
  if (instr.bold) builder.bold(false);
  if (instr.size && instr.size !== 'normal') builder.size('normal');
}

/**
 * Build ESC/POS bytes from print instructions.
 */
function buildFromInstructions(
  instructions: PrintInstruction[],
  paperWidth: PaperWidth,
): Uint8Array {
  const builder = new ESCPOSBuilder(paperWidth);

  for (const instr of instructions) {
    switch (instr.type) {
      case 'text':
        applyTextInstruction(builder, instr);
        break;
      case 'feed':
        builder.feed(instr.lines ?? 1);
        break;
      case 'separator':
        builder.separator(instr.char ?? '-');
        break;
      case 'cut':
        builder.cut();
        break;
    }
  }

  return builder.build();
}

/**
 * Build TicketData from a sale API response.
 *
 * Converts the sale detail object (from /api/sales/[id]) into the
 * TicketData format expected by the printing subsystem.
 */
export function saleToTicketData(sale: {
  ticket_number: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  created_at: string;
  stores?: {
    name: string;
    address?: string | null;
    phone?: string | null;
  } | null;
  users?: { full_name: string } | null;
  sale_lines: Array<{
    product_name: string;
    variant_description: string;
    quantity: number;
    unit_price: number;
    line_discount: number;
    line_total: number;
  }>;
  sale_payments: Array<{
    amount: number;
    amount_received?: number | null;
    change_amount?: number | null;
    payment_methods?: { name: string } | null;
  }>;
}): TicketData {
  // Try to load store config from localStorage
  let storeConfig: {
    storeTaxId?: string;
    returnPolicyText?: string;
  } = {};
  try {
    const saved = localStorage.getItem('ticket-template-config');
    if (saved) storeConfig = JSON.parse(saved);
  } catch {
    // Ignore parse errors
  }

  return {
    store: {
      name: sale.stores?.name ?? 'Tienda',
      address: sale.stores?.address ?? '',
      phone: sale.stores?.phone ?? '',
      tax_id: storeConfig.storeTaxId ?? '',
      return_policy_text: storeConfig.returnPolicyText,
    },
    ticket_number: sale.ticket_number,
    seller_name: sale.users?.full_name ?? '',
    lines: sale.sale_lines.map((l) => ({
      product_name: l.product_name,
      variant: l.variant_description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      line_discount: l.line_discount,
      line_total: l.line_total,
    })),
    subtotal: sale.subtotal,
    discount_amount: sale.discount_amount,
    tax_amount: sale.tax_amount,
    total: sale.total,
    payments: sale.sale_payments.map((p) => ({
      method: p.payment_methods?.name ?? 'Otro',
      amount: p.amount,
      received: p.amount_received ?? undefined,
      change: p.change_amount ?? undefined,
    })),
    created_at: sale.created_at,
  };
}

/**
 * Download a blob as a file in the browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Generate and download a sale ticket PDF.
 */
export function downloadTicketPDF(data: TicketData): void {
  const blob = generateTicketPDF(data);
  downloadBlob(blob, `ticket-${data.ticket_number}.pdf`);
}

/**
 * Generate and download a return note PDF.
 */
export function downloadReturnNotePDF(
  data: TicketData,
  returnNumber: string,
  originalTicket: string,
  reason: string,
): void {
  const blob = generateReturnNotePDF(data, returnNumber, originalTicket, reason);
  downloadBlob(blob, `devolucion-${returnNumber}.pdf`);
}

/**
 * Build ESC/POS bytes for a return note.
 */
export function buildReturnNoteTicket(
  data: TicketData,
  returnNumber: string,
  originalTicket: string,
  reason: string,
  paperWidth: PaperWidth = '80mm',
): Uint8Array {
  const instructions = buildReturnNoteLayout(
    data,
    returnNumber,
    originalTicket,
    reason,
    paperWidth,
  );
  return buildFromInstructions(instructions, paperWidth);
}
