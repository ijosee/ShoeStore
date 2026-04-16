/**
 * Unit tests for the printing subsystem.
 *
 * Tests the ESC/POS builder, ticket template, and print service utilities.
 *
 * Validates: Requirements 10.1, 10.2, 10.5
 */

import { describe, it, expect } from 'vitest';

import {
  ESCPOSBuilder,
  buildTicket,
} from '@/lib/printing/escpos-builder';
import {
  buildTicketLayout,
  buildReturnNoteLayout,
} from '@/lib/printing/ticket-template';
import {
  saleToTicketData,
} from '@/lib/printing/print-service';
import type { TicketData } from '@/types/printing';

// ─── Test data ───────────────────────────────────────────────────────────────

const SAMPLE_TICKET: TicketData = {
  store: {
    name: 'Tienda Centro',
    address: 'Av. Principal #123, Col. Centro',
    phone: '(555) 123-4567',
    tax_id: 'XAXX010101000',
    return_policy_text: 'Cambios y devoluciones dentro de 30 dias con ticket.',
  },
  ticket_number: 'TC-2024-000142',
  seller_name: 'Luis Pérez',
  lines: [
    {
      product_name: 'Zapato Oxford Classic',
      variant: 'T27-Negro',
      quantity: 1,
      unit_price: 1200,
      line_discount: 120,
      line_total: 1252.8,
    },
    {
      product_name: 'Tenis Sport Run',
      variant: 'T26-Blanco',
      quantity: 1,
      unit_price: 890,
      line_discount: 89,
      line_total: 929.16,
    },
  ],
  subtotal: 1881,
  discount_amount: 209,
  tax_amount: 300.96,
  total: 2181.96,
  payments: [
    {
      method: 'Tarjeta de Crédito',
      amount: 2181.96,
    },
  ],
  created_at: '2024-03-15T14:32:00Z',
};

// ─── ESCPOSBuilder ───────────────────────────────────────────────────────────

describe('ESCPOSBuilder', () => {
  it('should initialize with printer init command', () => {
    const builder = new ESCPOSBuilder('80mm');
    const bytes = builder.build();
    // ESC @ (init) = 0x1B 0x40
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
  });

  it('should support 80mm width (48 chars)', () => {
    const builder = new ESCPOSBuilder('80mm');
    expect(builder.getWidth()).toBe(48);
  });

  it('should support 58mm width (32 chars)', () => {
    const builder = new ESCPOSBuilder('58mm');
    expect(builder.getWidth()).toBe(32);
  });

  it('should write text followed by line feed', () => {
    const builder = new ESCPOSBuilder('80mm');
    builder.writeLine('Hello');
    const bytes = builder.build();
    // After init (2 bytes), should contain "Hello" + LF
    const text = new TextDecoder().decode(bytes.slice(2, 7));
    expect(text).toBe('Hello');
    expect(bytes[7]).toBe(0x0a); // LF
  });

  it('should set alignment commands', () => {
    const builder = new ESCPOSBuilder('80mm');
    builder.align('center');
    const bytes = builder.build();
    // ESC a 1 (center) = 0x1B 0x61 0x01
    expect(bytes[2]).toBe(0x1b);
    expect(bytes[3]).toBe(0x61);
    expect(bytes[4]).toBe(0x01);
  });

  it('should toggle bold on and off', () => {
    const builder = new ESCPOSBuilder('80mm');
    builder.bold(true);
    builder.bold(false);
    const bytes = builder.build();
    // Bold on: ESC E 1 = 0x1B 0x45 0x01
    expect(bytes[2]).toBe(0x1b);
    expect(bytes[3]).toBe(0x45);
    expect(bytes[4]).toBe(0x01);
    // Bold off: ESC E 0 = 0x1B 0x45 0x00
    expect(bytes[5]).toBe(0x1b);
    expect(bytes[6]).toBe(0x45);
    expect(bytes[7]).toBe(0x00);
  });

  it('should generate separator line of correct width', () => {
    const builder = new ESCPOSBuilder('80mm');
    builder.separator('-');
    const bytes = builder.build();
    // After init (2 bytes), should have 48 dashes + LF
    const separatorText = new TextDecoder().decode(bytes.slice(2, 50));
    expect(separatorText).toBe('-'.repeat(48));
  });

  it('should generate two-column text', () => {
    const builder = new ESCPOSBuilder('80mm');
    builder.twoColumns('Left', 'Right');
    const bytes = builder.build();
    const text = new TextDecoder().decode(bytes.slice(2, bytes.length - 1)); // exclude LF
    expect(text).toContain('Left');
    expect(text).toContain('Right');
    expect(text.length).toBe(48);
  });

  it('should add cut command', () => {
    const builder = new ESCPOSBuilder('80mm');
    builder.cut();
    const bytes = builder.build();
    // Cut command: GS V A 3 = 0x1D 0x56 0x41 0x03
    // After init (2 bytes) + 3 LFs (3 bytes) = offset 5
    const cutStart = bytes.length - 4;
    expect(bytes[cutStart]).toBe(0x1d);
    expect(bytes[cutStart + 1]).toBe(0x56);
    expect(bytes[cutStart + 2]).toBe(0x41);
    expect(bytes[cutStart + 3]).toBe(0x03);
  });

  it('should add multiple line feeds', () => {
    const builder = new ESCPOSBuilder('80mm');
    builder.feed(3);
    const bytes = builder.build();
    // After init (2 bytes), should have 3 LFs
    expect(bytes[2]).toBe(0x0a);
    expect(bytes[3]).toBe(0x0a);
    expect(bytes[4]).toBe(0x0a);
  });
});

// ─── Ticket Template ─────────────────────────────────────────────────────────

describe('buildTicketLayout', () => {
  it('should generate instructions for a complete ticket', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    expect(instructions.length).toBeGreaterThan(0);
  });

  it('should start with store name centered and bold', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    const first = instructions[0];
    expect(first.type).toBe('text');
    if (first.type === 'text') {
      expect(first.content).toBe('Tienda Centro');
      expect(first.align).toBe('center');
      expect(first.bold).toBe(true);
    }
  });

  it('should include ticket number', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    const ticketLine = instructions.find(
      (i) => i.type === 'text' && 'content' in i && i.content.includes('TC-2024-000142'),
    );
    expect(ticketLine).toBeDefined();
  });

  it('should include seller name', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    const sellerLine = instructions.find(
      (i) => i.type === 'text' && 'content' in i && i.content.includes('Luis'),
    );
    expect(sellerLine).toBeDefined();
  });

  it('should include line items', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    const oxfordLine = instructions.find(
      (i) => i.type === 'text' && 'content' in i && i.content.includes('Oxford'),
    );
    expect(oxfordLine).toBeDefined();
  });

  it('should include total', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    const totalLine = instructions.find(
      (i) => i.type === 'text' && 'content' in i && i.content.includes('TOTAL:'),
    );
    expect(totalLine).toBeDefined();
  });

  it('should include payment method', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    const paymentLine = instructions.find(
      (i) =>
        i.type === 'text' &&
        'content' in i &&
        i.content.includes('Tarjeta'),
    );
    expect(paymentLine).toBeDefined();
  });

  it('should include return policy when provided', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    const policyLine = instructions.find(
      (i) =>
        i.type === 'text' &&
        'content' in i &&
        i.content.includes('devoluciones'),
    );
    expect(policyLine).toBeDefined();
  });

  it('should omit return policy when not provided', () => {
    const dataNoPolicy = {
      ...SAMPLE_TICKET,
      store: { ...SAMPLE_TICKET.store, return_policy_text: undefined },
    };
    const instructions = buildTicketLayout(dataNoPolicy, '80mm');
    const policyLine = instructions.find(
      (i) =>
        i.type === 'text' &&
        'content' in i &&
        i.content.includes('devoluciones'),
    );
    expect(policyLine).toBeUndefined();
  });

  it('should end with a cut instruction', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    const last = instructions[instructions.length - 1];
    expect(last.type).toBe('cut');
  });

  it('should include thank you message', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '80mm');
    const thankYou = instructions.find(
      (i) =>
        i.type === 'text' &&
        'content' in i &&
        i.content.includes('Gracias'),
    );
    expect(thankYou).toBeDefined();
  });

  it('should work with 58mm paper width', () => {
    const instructions = buildTicketLayout(SAMPLE_TICKET, '58mm');
    expect(instructions.length).toBeGreaterThan(0);
    // Verify it still has all sections
    const hasTotal = instructions.some(
      (i) => i.type === 'text' && 'content' in i && i.content.includes('TOTAL:'),
    );
    expect(hasTotal).toBe(true);
  });
});

// ─── Return Note Layout ──────────────────────────────────────────────────────

describe('buildReturnNoteLayout', () => {
  it('should generate instructions for a return note', () => {
    const instructions = buildReturnNoteLayout(
      SAMPLE_TICKET,
      'DEV-TC-2024-000142-01',
      'TC-2024-000142',
      'Defecto de fábrica',
      '80mm',
    );
    expect(instructions.length).toBeGreaterThan(0);
  });

  it('should include NOTA DE DEVOLUCION title', () => {
    const instructions = buildReturnNoteLayout(
      SAMPLE_TICKET,
      'DEV-TC-2024-000142-01',
      'TC-2024-000142',
      'Defecto de fábrica',
    );
    const title = instructions.find(
      (i) =>
        i.type === 'text' &&
        'content' in i &&
        i.content.includes('NOTA DE DEVOLUCION'),
    );
    expect(title).toBeDefined();
  });

  it('should include return number', () => {
    const instructions = buildReturnNoteLayout(
      SAMPLE_TICKET,
      'DEV-TC-2024-000142-01',
      'TC-2024-000142',
      'Defecto de fábrica',
    );
    const returnNum = instructions.find(
      (i) =>
        i.type === 'text' &&
        'content' in i &&
        i.content.includes('DEV-TC-2024-000142-01'),
    );
    expect(returnNum).toBeDefined();
  });

  it('should include original ticket reference', () => {
    const instructions = buildReturnNoteLayout(
      SAMPLE_TICKET,
      'DEV-TC-2024-000142-01',
      'TC-2024-000142',
      'Defecto de fábrica',
    );
    const origTicket = instructions.find(
      (i) =>
        i.type === 'text' &&
        'content' in i &&
        i.content.includes('TC-2024-000142'),
    );
    expect(origTicket).toBeDefined();
  });

  it('should include reason', () => {
    const instructions = buildReturnNoteLayout(
      SAMPLE_TICKET,
      'DEV-TC-2024-000142-01',
      'TC-2024-000142',
      'Defecto de fábrica',
    );
    const reasonLine = instructions.find(
      (i) =>
        i.type === 'text' &&
        'content' in i &&
        i.content.includes('Defecto'),
    );
    expect(reasonLine).toBeDefined();
  });

  it('should include TOTAL REEMBOLSO', () => {
    const instructions = buildReturnNoteLayout(
      SAMPLE_TICKET,
      'DEV-TC-2024-000142-01',
      'TC-2024-000142',
      'Defecto de fábrica',
    );
    const totalLine = instructions.find(
      (i) =>
        i.type === 'text' &&
        'content' in i &&
        i.content.includes('TOTAL REEMBOLSO'),
    );
    expect(totalLine).toBeDefined();
  });
});

// ─── buildTicket (high-level) ────────────────────────────────────────────────

describe('buildTicket', () => {
  it('should return a Uint8Array', () => {
    const result = buildTicket(SAMPLE_TICKET, '80mm');
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should start with ESC @ (init command)', () => {
    const result = buildTicket(SAMPLE_TICKET, '80mm');
    expect(result[0]).toBe(0x1b);
    expect(result[1]).toBe(0x40);
  });

  it('should contain the store name text', () => {
    const result = buildTicket(SAMPLE_TICKET, '80mm');
    const text = new TextDecoder().decode(result);
    expect(text).toContain('Tienda Centro');
  });

  it('should contain the ticket number', () => {
    const result = buildTicket(SAMPLE_TICKET, '80mm');
    const text = new TextDecoder().decode(result);
    expect(text).toContain('TC-2024-000142');
  });

  it('should contain product names', () => {
    const result = buildTicket(SAMPLE_TICKET, '80mm');
    const text = new TextDecoder().decode(result);
    expect(text).toContain('Zapato Oxford Classic');
    expect(text).toContain('Tenis Sport Run');
  });

  it('should work with 58mm paper', () => {
    const result = buildTicket(SAMPLE_TICKET, '58mm');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should produce different output for different paper widths', () => {
    const result80 = buildTicket(SAMPLE_TICKET, '80mm');
    const result58 = buildTicket(SAMPLE_TICKET, '58mm');
    // Different widths should produce different byte arrays
    // (separator lines are different lengths)
    expect(result80.length).not.toBe(result58.length);
  });
});

// ─── saleToTicketData ────────────────────────────────────────────────────────

describe('saleToTicketData', () => {
  const saleData = {
    ticket_number: 'TC-2024-000001',
    subtotal: 1000,
    discount_amount: 100,
    tax_amount: 144,
    total: 1044,
    created_at: '2024-01-15T10:00:00Z',
    stores: {
      name: 'Tienda Centro',
      address: 'Av. Principal #123',
      phone: '(555) 123-4567',
    },
    users: { full_name: 'Juan Pérez' },
    sale_lines: [
      {
        product_name: 'Zapato Test',
        variant_description: 'T27-Negro',
        quantity: 1,
        unit_price: 1000,
        line_discount: 100,
        line_total: 1044,
      },
    ],
    sale_payments: [
      {
        amount: 1044,
        amount_received: 1100,
        change_amount: 56,
        payment_methods: { name: 'Efectivo' },
      },
    ],
  };

  it('should convert sale data to TicketData format', () => {
    const result = saleToTicketData(saleData);
    expect(result.ticket_number).toBe('TC-2024-000001');
    expect(result.total).toBe(1044);
    expect(result.seller_name).toBe('Juan Pérez');
  });

  it('should map store info correctly', () => {
    const result = saleToTicketData(saleData);
    expect(result.store.name).toBe('Tienda Centro');
    expect(result.store.address).toBe('Av. Principal #123');
    expect(result.store.phone).toBe('(555) 123-4567');
  });

  it('should map sale lines correctly', () => {
    const result = saleToTicketData(saleData);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].product_name).toBe('Zapato Test');
    expect(result.lines[0].variant).toBe('T27-Negro');
    expect(result.lines[0].quantity).toBe(1);
  });

  it('should map payments correctly', () => {
    const result = saleToTicketData(saleData);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].method).toBe('Efectivo');
    expect(result.payments[0].amount).toBe(1044);
    expect(result.payments[0].received).toBe(1100);
    expect(result.payments[0].change).toBe(56);
  });

  it('should handle missing store data gracefully', () => {
    const noStore = { ...saleData, stores: null };
    const result = saleToTicketData(noStore);
    expect(result.store.name).toBe('Tienda');
    expect(result.store.address).toBe('');
  });

  it('should handle missing user data gracefully', () => {
    const noUser = { ...saleData, users: null };
    const result = saleToTicketData(noUser);
    expect(result.seller_name).toBe('');
  });

  it('should handle missing payment method name', () => {
    const noPaymentMethod = {
      ...saleData,
      sale_payments: [
        { amount: 1044, amount_received: null, change_amount: null, payment_methods: null },
      ],
    };
    const result = saleToTicketData(noPaymentMethod);
    expect(result.payments[0].method).toBe('Otro');
  });
});
