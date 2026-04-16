-- Migration 007: Create sales tables (sales, sale_lines, sale_payments, ticket_sequences)
-- Requirements: 6.5, 6.8, 6.9, 7.2, 7.3, 8.1, 8.2, 8.3

-- ─── ENUM Types ──────────────────────────────────────────────────────────────

CREATE TYPE sale_status AS ENUM ('completed', 'voided');

CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount');

-- ─── Sales ───────────────────────────────────────────────────────────────────

CREATE TABLE sales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number     TEXT NOT NULL,
  store_id          UUID NOT NULL REFERENCES stores(id),
  seller_id         UUID NOT NULL REFERENCES users(id),
  subtotal          NUMERIC(10, 2) NOT NULL,
  discount_amount   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_type     discount_type,
  discount_value    NUMERIC(10, 2),
  tax_amount        NUMERIC(10, 2) NOT NULL,
  total             NUMERIC(10, 2) NOT NULL,
  status            sale_status NOT NULL DEFAULT 'completed',
  voided_by         UUID REFERENCES users(id),
  voided_at         TIMESTAMPTZ,
  void_reason       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT sales_ticket_number_not_empty CHECK (char_length(ticket_number) > 0),
  CONSTRAINT sales_subtotal_non_negative CHECK (subtotal >= 0),
  CONSTRAINT sales_discount_amount_non_negative CHECK (discount_amount >= 0),
  CONSTRAINT sales_tax_amount_non_negative CHECK (tax_amount >= 0),
  CONSTRAINT sales_total_non_negative CHECK (total >= 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_sales_ticket_number ON sales (ticket_number);
CREATE INDEX idx_sales_store_id ON sales (store_id);
CREATE INDEX idx_sales_seller_id ON sales (seller_id);
CREATE INDEX idx_sales_created_at ON sales (created_at);
CREATE INDEX idx_sales_status ON sales (status);

COMMENT ON TABLE sales IS 'Completed and voided sales transactions. Each sale has a unique ticket number per store/year.';

-- ─── Sale Lines ──────────────────────────────────────────────────────────────

CREATE TABLE sale_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id               UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id            UUID NOT NULL REFERENCES product_variants(id),
  product_name          TEXT NOT NULL,
  variant_description   TEXT NOT NULL,
  quantity              INTEGER NOT NULL,
  unit_price            NUMERIC(10, 2) NOT NULL,
  line_discount         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_rate              NUMERIC(5, 4) NOT NULL,
  line_subtotal         NUMERIC(10, 2) NOT NULL,
  line_tax              NUMERIC(10, 2) NOT NULL,
  line_total            NUMERIC(10, 2) NOT NULL,

  -- Constraints
  CONSTRAINT sale_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT sale_lines_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT sale_lines_line_discount_non_negative CHECK (line_discount >= 0),
  CONSTRAINT sale_lines_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 1),
  CONSTRAINT sale_lines_line_subtotal_non_negative CHECK (line_subtotal >= 0),
  CONSTRAINT sale_lines_line_tax_non_negative CHECK (line_tax >= 0),
  CONSTRAINT sale_lines_line_total_non_negative CHECK (line_total >= 0),
  CONSTRAINT sale_lines_product_name_not_empty CHECK (char_length(product_name) > 0),
  CONSTRAINT sale_lines_variant_description_not_empty CHECK (char_length(variant_description) > 0)
);

-- Indexes
CREATE INDEX idx_sale_lines_sale_id ON sale_lines (sale_id);
CREATE INDEX idx_sale_lines_variant_id ON sale_lines (variant_id);

COMMENT ON TABLE sale_lines IS 'Individual line items within a sale. Stores snapshot of product name and variant description at time of sale.';

-- ─── Sale Payments ───────────────────────────────────────────────────────────

CREATE TABLE sale_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id             UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method_id   UUID NOT NULL REFERENCES payment_methods(id),
  amount              NUMERIC(10, 2) NOT NULL,
  amount_received     NUMERIC(10, 2),
  change_amount       NUMERIC(10, 2),

  -- Constraints
  CONSTRAINT sale_payments_amount_positive CHECK (amount > 0),
  CONSTRAINT sale_payments_amount_received_non_negative CHECK (amount_received IS NULL OR amount_received >= 0),
  CONSTRAINT sale_payments_change_amount_non_negative CHECK (change_amount IS NULL OR change_amount >= 0)
);

-- Indexes
CREATE INDEX idx_sale_payments_sale_id ON sale_payments (sale_id);
CREATE INDEX idx_sale_payments_payment_method_id ON sale_payments (payment_method_id);

COMMENT ON TABLE sale_payments IS 'Payment records for each sale. Supports mixed payments (e.g., part cash, part card) with change calculation for cash.';

-- ─── Ticket Sequences ────────────────────────────────────────────────────────

CREATE TABLE ticket_sequences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id),
  year            INTEGER NOT NULL,
  last_sequence   INTEGER NOT NULL DEFAULT 0,

  -- Constraints
  CONSTRAINT ticket_sequences_year_valid CHECK (year >= 2000 AND year <= 9999),
  CONSTRAINT ticket_sequences_last_sequence_non_negative CHECK (last_sequence >= 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_ticket_sequences_store_year ON ticket_sequences (store_id, year);

COMMENT ON TABLE ticket_sequences IS 'Atomic ticket number sequences per store per year. Used by next_ticket_number() to generate sequential ticket numbers.';
