/**
 * PDF fallback for ticket generation when Bluetooth printing is unavailable.
 *
 * Uses jsPDF to generate a receipt-style PDF that mimics the thermal printer
 * output. The PDF uses an 80mm-wide page format.
 *
 * Validates: Requirements 10.4
 */

import { jsPDF } from 'jspdf';

import type { TicketData, TicketLine, TicketPayment } from '@/types/printing';
import { formatMXN } from '@/lib/utils/currency';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Page width in mm (80mm receipt paper). */
const PAGE_WIDTH_MM = 80;

/** Margins in mm. */
const MARGIN_LEFT = 4;
const MARGIN_RIGHT = 4;
const CONTENT_WIDTH = PAGE_WIDTH_MM - MARGIN_LEFT - MARGIN_RIGHT;

/** Font sizes in points. */
const FONT_SIZE_TITLE = 12;
const FONT_SIZE_NORMAL = 8;
const FONT_SIZE_SMALL = 7;
const FONT_SIZE_TOTAL = 11;

/** Line height multiplier. */
const LINE_HEIGHT = 3.5;
const LINE_HEIGHT_SMALL = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTicketDate(isoDate: string): string {
  const d = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── PDF Builder ─────────────────────────────────────────────────────────────

/**
 * Generate a receipt-style PDF from ticket data.
 *
 * @param data - The ticket data to render
 * @returns Blob containing the PDF file
 */
export function generateTicketPDF(data: TicketData): Blob {
  // Create a tall, narrow PDF (80mm wide, auto-height)
  // We'll use a generous initial height and trim later
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAGE_WIDTH_MM, 300], // tall enough for most tickets
  });

  let y = 6; // Current Y position

  // ── Helper functions ───────────────────────────────────────────────────

  function setFont(
    style: 'normal' | 'bold' = 'normal',
    size: number = FONT_SIZE_NORMAL,
  ) {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
  }

  function centerText(text: string, fontSize?: number) {
    if (fontSize) setFont('normal', fontSize);
    doc.text(text, PAGE_WIDTH_MM / 2, y, { align: 'center' });
    y += LINE_HEIGHT;
  }

  function centerBoldText(text: string, fontSize?: number) {
    if (fontSize) setFont('bold', fontSize);
    else setFont('bold');
    doc.text(text, PAGE_WIDTH_MM / 2, y, { align: 'center' });
    y += LINE_HEIGHT;
    setFont('normal');
  }

  function leftText(text: string) {
    doc.text(text, MARGIN_LEFT, y);
    y += LINE_HEIGHT;
  }

  function twoColText(left: string, right: string) {
    doc.text(left, MARGIN_LEFT, y);
    doc.text(right, PAGE_WIDTH_MM - MARGIN_RIGHT, y, { align: 'right' });
    y += LINE_HEIGHT;
  }

  function separator(char: string = '-') {
    const lineWidth = char === '=' ? 0.4 : 0.2;
    doc.setLineWidth(lineWidth);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH_MM - MARGIN_RIGHT, y);
    y += 2;
  }

  function addSpace(mm: number = 2) {
    y += mm;
  }

  // ── 1. Store Header ────────────────────────────────────────────────────

  centerBoldText(data.store.name, FONT_SIZE_TITLE);

  setFont('normal', FONT_SIZE_SMALL);

  if (data.store.address) {
    // Wrap long addresses
    const lines = doc.splitTextToSize(data.store.address, CONTENT_WIDTH);
    for (const line of lines) {
      centerText(line, FONT_SIZE_SMALL);
    }
  }

  if (data.store.phone) {
    centerText(`Tel: ${data.store.phone}`, FONT_SIZE_SMALL);
  }

  if (data.store.tax_id) {
    centerText(`RFC: ${data.store.tax_id}`, FONT_SIZE_SMALL);
  }

  addSpace(2);
  separator('=');

  // ── 2. Ticket Info ─────────────────────────────────────────────────────

  setFont('bold', FONT_SIZE_NORMAL);
  twoColText('Ticket:', data.ticket_number);

  setFont('normal', FONT_SIZE_NORMAL);
  twoColText('Fecha:', formatTicketDate(data.created_at));
  twoColText('Vendedor:', data.seller_name);

  separator();

  // ── 3. Line Items ──────────────────────────────────────────────────────

  setFont('normal', FONT_SIZE_NORMAL);

  for (const line of data.lines) {
    renderLineItem(doc, line);
  }

  separator();

  // ── 4. Totals ──────────────────────────────────────────────────────────

  setFont('normal', FONT_SIZE_NORMAL);
  twoColText('Subtotal:', formatMXN(data.subtotal));

  if (data.discount_amount > 0) {
    twoColText('Descuento:', `-${formatMXN(data.discount_amount)}`);
  }

  twoColText('IVA:', formatMXN(data.tax_amount));

  separator('=');

  setFont('bold', FONT_SIZE_TOTAL);
  twoColText('TOTAL:', formatMXN(data.total));
  y += 1;

  separator('=');

  // ── 5. Payment Info ────────────────────────────────────────────────────

  setFont('bold', FONT_SIZE_NORMAL);
  leftText('Forma de Pago:');

  setFont('normal', FONT_SIZE_NORMAL);
  for (const payment of data.payments) {
    renderPayment(doc, payment);
  }

  addSpace(3);

  // ── 6. Return Policy Footer ────────────────────────────────────────────

  if (data.store.return_policy_text) {
    separator();
    setFont('normal', FONT_SIZE_SMALL);
    const policyLines = doc.splitTextToSize(
      data.store.return_policy_text,
      CONTENT_WIDTH,
    );
    for (const line of policyLines) {
      centerText(line, FONT_SIZE_SMALL);
    }
  }

  addSpace(2);

  // Thank you
  centerBoldText('Gracias por su compra!', FONT_SIZE_NORMAL);

  // ── Generate Blob ──────────────────────────────────────────────────────

  return doc.output('blob');

  // ── Nested render helpers (closure over doc and y) ─────────────────────

  function renderLineItem(_doc: jsPDF, line: TicketLine) {
    setFont('normal', FONT_SIZE_NORMAL);

    // Product name + variant
    const productText = `${line.product_name} ${line.variant}`;
    const wrappedName = _doc.splitTextToSize(productText, CONTENT_WIDTH);
    for (const nameLine of wrappedName) {
      leftText(nameLine);
    }

    // Qty x price = total
    setFont('normal', FONT_SIZE_SMALL);
    twoColText(
      `  ${line.quantity} x ${formatMXN(line.unit_price)}`,
      formatMXN(line.line_total),
    );

    if (line.line_discount > 0) {
      twoColText('    Desc:', `-${formatMXN(line.line_discount)}`);
    }

    y += 1; // Small gap between items
  }

  function renderPayment(_doc: jsPDF, payment: TicketPayment) {
    twoColText(`  ${payment.method}`, formatMXN(payment.amount));

    if (payment.received != null && payment.received > 0) {
      setFont('normal', FONT_SIZE_SMALL);
      twoColText('    Recibido:', formatMXN(payment.received));
    }

    if (payment.change != null && payment.change > 0) {
      setFont('normal', FONT_SIZE_SMALL);
      twoColText('    Cambio:', formatMXN(payment.change));
    }
  }
}

/**
 * Generate a return note PDF.
 *
 * @param data - Ticket data with return items
 * @param returnNumber - Return document number
 * @param originalTicket - Original sale ticket number
 * @param reason - Return reason text
 * @returns Blob containing the PDF file
 */
export function generateReturnNotePDF(
  data: TicketData,
  returnNumber: string,
  originalTicket: string,
  reason: string,
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAGE_WIDTH_MM, 300],
  });

  let y = 6;

  function setFont(
    style: 'normal' | 'bold' = 'normal',
    size: number = FONT_SIZE_NORMAL,
  ) {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
  }

  function centerBoldText(text: string, fontSize?: number) {
    if (fontSize) setFont('bold', fontSize);
    else setFont('bold');
    doc.text(text, PAGE_WIDTH_MM / 2, y, { align: 'center' });
    y += LINE_HEIGHT;
    setFont('normal');
  }

  function centerText(text: string, fontSize?: number) {
    if (fontSize) setFont('normal', fontSize);
    doc.text(text, PAGE_WIDTH_MM / 2, y, { align: 'center' });
    y += LINE_HEIGHT;
  }

  function leftText(text: string) {
    doc.text(text, MARGIN_LEFT, y);
    y += LINE_HEIGHT;
  }

  function twoColText(left: string, right: string) {
    doc.text(left, MARGIN_LEFT, y);
    doc.text(right, PAGE_WIDTH_MM - MARGIN_RIGHT, y, { align: 'right' });
    y += LINE_HEIGHT;
  }

  function separator(char: string = '-') {
    const lineWidth = char === '=' ? 0.4 : 0.2;
    doc.setLineWidth(lineWidth);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH_MM - MARGIN_RIGHT, y);
    y += 2;
  }

  function addSpace(mm: number = 2) {
    y += mm;
  }

  // ── Store Header ───────────────────────────────────────────────────────

  centerBoldText(data.store.name, FONT_SIZE_TITLE);

  setFont('normal', FONT_SIZE_SMALL);
  if (data.store.address) {
    const lines = doc.splitTextToSize(data.store.address, CONTENT_WIDTH);
    for (const line of lines) {
      centerText(line, FONT_SIZE_SMALL);
    }
  }

  addSpace(2);
  separator('=');

  // ── Title ──────────────────────────────────────────────────────────────

  centerBoldText('NOTA DE DEVOLUCION', FONT_SIZE_TITLE);
  addSpace(2);

  // ── Return Info ────────────────────────────────────────────────────────

  setFont('bold', FONT_SIZE_NORMAL);
  twoColText('No. Devolucion:', returnNumber);

  setFont('normal', FONT_SIZE_NORMAL);
  twoColText('Ticket Orig.:', originalTicket);
  twoColText('Fecha:', formatTicketDate(data.created_at));
  twoColText('Atendio:', data.seller_name);
  twoColText('Motivo:', reason);

  separator();

  // ── Returned Items ─────────────────────────────────────────────────────

  setFont('bold', FONT_SIZE_NORMAL);
  leftText('Articulos Devueltos:');

  setFont('normal', FONT_SIZE_NORMAL);
  for (const line of data.lines) {
    const productText = `${line.product_name} ${line.variant}`;
    const wrappedName = doc.splitTextToSize(productText, CONTENT_WIDTH);
    for (const nameLine of wrappedName) {
      leftText(nameLine);
    }

    setFont('normal', FONT_SIZE_SMALL);
    twoColText(
      `  ${line.quantity} x ${formatMXN(line.unit_price)}`,
      formatMXN(line.line_total),
    );
    y += 1;
  }

  separator('=');

  // ── Refund Total ───────────────────────────────────────────────────────

  setFont('bold', FONT_SIZE_TOTAL);
  twoColText('TOTAL REEMBOLSO:', formatMXN(data.total));

  separator('=');
  addSpace(4);

  return doc.output('blob');
}
