/**
 * Ticket layout template for ESC/POS and PDF rendering.
 *
 * Generates an array of PrintInstructions that describe the ticket layout.
 * This is consumed by both the ESC/POS builder and the PDF fallback.
 *
 * Template sections:
 * 1. Store header (name, address, phone, RFC)
 * 2. Ticket info (number, date, seller)
 * 3. Line items (product, variant, qty, price, subtotal)
 * 4. Discounts
 * 5. Totals (subtotal, IVA, total)
 * 6. Payment info (method, received, change)
 * 7. Return policy footer
 *
 * Validates: Requirements 10.1, 10.2
 */

import type { PaperWidth, TicketData, TicketLine, TicketPayment } from '@/types/printing';
import type { PrintInstruction } from './escpos-builder';
import { PAPER_WIDTH_CHARS } from '@/lib/constants';
import { formatMXN } from '@/lib/utils/currency';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTicketDate(isoDate: string): string {
  const d = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Create a two-column text line: left-aligned label, right-aligned value.
 * Pads with spaces to fill the given width.
 */
function twoCol(left: string, right: string, width: number): string {
  const gap = width - left.length - right.length;
  if (gap <= 0) {
    const maxLeft = Math.max(1, width - right.length - 1);
    return left.substring(0, maxLeft) + ' ' + right;
  }
  return left + ' '.repeat(gap) + right;
}

/**
 * Wrap text to fit within a given character width.
 * Returns an array of lines.
 */
function wrapText(text: string, width: number): string[] {
  if (text.length <= width) return [text];

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= width) {
      lines.push(remaining);
      break;
    }

    // Find last space within width
    let breakAt = remaining.lastIndexOf(' ', width);
    if (breakAt <= 0) {
      breakAt = width;
    }

    lines.push(remaining.substring(0, breakAt));
    remaining = remaining.substring(breakAt).trimStart();
  }

  return lines;
}

// ─── Line item formatting ────────────────────────────────────────────────────

function formatLineItem(line: TicketLine, width: number): PrintInstruction[] {
  const instructions: PrintInstruction[] = [];

  // Product name + variant (may wrap)
  const productText = `${line.product_name} ${line.variant}`;
  const wrappedName = wrapText(productText, width);
  for (const nameLine of wrappedName) {
    instructions.push({ type: 'text', content: nameLine });
  }

  // Quantity x price = total
  const qtyPrice = `  ${line.quantity} x ${formatMXN(line.unit_price)}`;
  const lineTotal = formatMXN(line.line_total);
  instructions.push({
    type: 'text',
    content: twoCol(qtyPrice, lineTotal, width),
  });

  // Show line discount if any
  if (line.line_discount > 0) {
    instructions.push({
      type: 'text',
      content: twoCol('    Desc:', `-${formatMXN(line.line_discount)}`, width),
    });
  }

  return instructions;
}

// ─── Payment formatting ──────────────────────────────────────────────────────

function formatPayment(payment: TicketPayment, width: number): PrintInstruction[] {
  const instructions: PrintInstruction[] = [];

  instructions.push({
    type: 'text',
    content: twoCol(`  ${payment.method}`, formatMXN(payment.amount), width),
  });

  if (payment.received != null && payment.received > 0) {
    instructions.push({
      type: 'text',
      content: twoCol('    Recibido:', formatMXN(payment.received), width),
    });
  }

  if (payment.change != null && payment.change > 0) {
    instructions.push({
      type: 'text',
      content: twoCol('    Cambio:', formatMXN(payment.change), width),
    });
  }

  return instructions;
}

// ─── Main template builder ───────────────────────────────────────────────────

/**
 * Build the ticket layout as an array of print instructions.
 *
 * @param data - Ticket data
 * @param paperWidth - Paper width (58mm or 80mm)
 * @returns Array of PrintInstruction for rendering
 */
export function buildTicketLayout(
  data: TicketData,
  paperWidth: PaperWidth = '80mm',
): PrintInstruction[] {
  const width = PAPER_WIDTH_CHARS[paperWidth];
  const instructions: PrintInstruction[] = [];

  // ── 1. Store Header ──────────────────────────────────────────────────────

  // Store name (centered, bold, double-height)
  instructions.push({
    type: 'text',
    content: data.store.name,
    align: 'center',
    bold: true,
    size: 'double-height',
  });

  // Address
  if (data.store.address) {
    const addressLines = wrapText(data.store.address, width);
    for (const line of addressLines) {
      instructions.push({ type: 'text', content: line, align: 'center' });
    }
  }

  // Phone
  if (data.store.phone) {
    instructions.push({
      type: 'text',
      content: `Tel: ${data.store.phone}`,
      align: 'center',
    });
  }

  // RFC / Tax ID
  if (data.store.tax_id) {
    instructions.push({
      type: 'text',
      content: `RFC: ${data.store.tax_id}`,
      align: 'center',
    });
  }

  instructions.push({ type: 'feed', lines: 1 });
  instructions.push({ type: 'separator', char: '=' });

  // ── 2. Ticket Info ───────────────────────────────────────────────────────

  instructions.push({
    type: 'text',
    content: twoCol('Ticket:', data.ticket_number, width),
    bold: true,
  });

  instructions.push({
    type: 'text',
    content: twoCol('Fecha:', formatTicketDate(data.created_at), width),
  });

  instructions.push({
    type: 'text',
    content: twoCol('Vendedor:', data.seller_name, width),
  });

  instructions.push({ type: 'separator' });

  // ── 3. Line Items ────────────────────────────────────────────────────────

  for (const line of data.lines) {
    instructions.push(...formatLineItem(line, width));
  }

  instructions.push({ type: 'separator' });

  // ── 4. Totals ────────────────────────────────────────────────────────────

  instructions.push({
    type: 'text',
    content: twoCol('Subtotal:', formatMXN(data.subtotal), width),
  });

  if (data.discount_amount > 0) {
    instructions.push({
      type: 'text',
      content: twoCol('Descuento:', `-${formatMXN(data.discount_amount)}`, width),
    });
  }

  instructions.push({
    type: 'text',
    content: twoCol('IVA:', formatMXN(data.tax_amount), width),
  });

  instructions.push({ type: 'separator', char: '=' });

  // Total (bold, double-height)
  instructions.push({
    type: 'text',
    content: twoCol('TOTAL:', formatMXN(data.total), width),
    bold: true,
    size: 'double-height',
  });

  instructions.push({ type: 'separator', char: '=' });

  // ── 5. Payment Info ──────────────────────────────────────────────────────

  instructions.push({
    type: 'text',
    content: 'Forma de Pago:',
    bold: true,
  });

  for (const payment of data.payments) {
    instructions.push(...formatPayment(payment, width));
  }

  instructions.push({ type: 'feed', lines: 1 });

  // ── 6. Return Policy Footer ──────────────────────────────────────────────

  if (data.store.return_policy_text) {
    instructions.push({ type: 'separator', char: '-' });
    const policyLines = wrapText(data.store.return_policy_text, width);
    for (const line of policyLines) {
      instructions.push({ type: 'text', content: line, align: 'center' });
    }
  }

  instructions.push({ type: 'feed', lines: 1 });

  // Thank you message
  instructions.push({
    type: 'text',
    content: 'Gracias por su compra!',
    align: 'center',
    bold: true,
  });

  instructions.push({ type: 'feed', lines: 1 });

  // ── 7. Cut ───────────────────────────────────────────────────────────────

  instructions.push({ type: 'cut' });

  return instructions;
}

/**
 * Build a return note layout as an array of print instructions.
 *
 * @param data - Return note data (uses TicketData with return-specific fields)
 * @param returnNumber - The return document number
 * @param originalTicket - The original sale ticket number
 * @param reason - Return reason text
 * @param paperWidth - Paper width
 * @returns Array of PrintInstruction
 */
export function buildReturnNoteLayout(
  data: TicketData,
  returnNumber: string,
  originalTicket: string,
  reason: string,
  paperWidth: PaperWidth = '80mm',
): PrintInstruction[] {
  const width = PAPER_WIDTH_CHARS[paperWidth];
  const instructions: PrintInstruction[] = [];

  // ── Store Header ─────────────────────────────────────────────────────────

  instructions.push({
    type: 'text',
    content: data.store.name,
    align: 'center',
    bold: true,
    size: 'double-height',
  });

  if (data.store.address) {
    const addressLines = wrapText(data.store.address, width);
    for (const line of addressLines) {
      instructions.push({ type: 'text', content: line, align: 'center' });
    }
  }

  instructions.push({ type: 'feed', lines: 1 });
  instructions.push({ type: 'separator', char: '=' });

  // ── Return Note Title ────────────────────────────────────────────────────

  instructions.push({
    type: 'text',
    content: 'NOTA DE DEVOLUCION',
    align: 'center',
    bold: true,
    size: 'double-height',
  });

  instructions.push({ type: 'feed', lines: 1 });

  instructions.push({
    type: 'text',
    content: twoCol('No. Devolucion:', returnNumber, width),
    bold: true,
  });

  instructions.push({
    type: 'text',
    content: twoCol('Ticket Orig.:', originalTicket, width),
  });

  instructions.push({
    type: 'text',
    content: twoCol('Fecha:', formatTicketDate(data.created_at), width),
  });

  instructions.push({
    type: 'text',
    content: twoCol('Atendio:', data.seller_name, width),
  });

  instructions.push({
    type: 'text',
    content: twoCol('Motivo:', reason, width),
  });

  instructions.push({ type: 'separator' });

  // ── Returned Items ───────────────────────────────────────────────────────

  instructions.push({
    type: 'text',
    content: 'Articulos Devueltos:',
    bold: true,
  });

  for (const line of data.lines) {
    instructions.push(...formatLineItem(line, width));
  }

  instructions.push({ type: 'separator', char: '=' });

  // ── Refund Total ─────────────────────────────────────────────────────────

  instructions.push({
    type: 'text',
    content: twoCol('TOTAL REEMBOLSO:', formatMXN(data.total), width),
    bold: true,
    size: 'double-height',
  });

  instructions.push({ type: 'separator', char: '=' });
  instructions.push({ type: 'feed', lines: 2 });

  // ── Cut ──────────────────────────────────────────────────────────────────

  instructions.push({ type: 'cut' });

  return instructions;
}
