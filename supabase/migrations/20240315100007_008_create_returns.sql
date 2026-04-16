-- Migration 008: Create returns tables (returns, return_lines)
-- Requirements: 9.1, 9.2, 9.3, 9.4

-- ─── ENUM Types ──────────────────────────────────────────────────────────────

CREATE TYPE return_reason AS ENUM (
  'factory_defect',
  'wrong_size',
  'not_satisfied',
  'transport_damage',
  'other'
);

CREATE TYPE return_status AS ENUM ('completed', 'cancelled');

-- ─── Returns ─────────────────────────────────────────────────────────────────

CREATE TABLE returns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number     TEXT NOT NULL,
  original_sale_id  UUID NOT NULL REFERENCES sales(id),
  store_id          UUID NOT NULL REFERENCES stores(id),
  processed_by      UUID NOT NULL REFERENCES users(id),
  approved_by       UUID REFERENCES users(id),
  reason            return_reason NOT NULL,
  reason_note       TEXT,
  refund_amount     NUMERIC(10, 2) NOT NULL,
  status            return_status NOT NULL DEFAULT 'completed',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT returns_return_number_not_empty CHECK (char_length(return_number) > 0),
  CONSTRAINT returns_refund_amount_non_negative CHECK (refund_amount >= 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_returns_return_number ON returns (return_number);
CREATE INDEX idx_returns_original_sale_id ON returns (original_sale_id);
CREATE INDEX idx_returns_store_id ON returns (store_id);
CREATE INDEX idx_returns_processed_by ON returns (processed_by);
CREATE INDEX idx_returns_status ON returns (status);
CREATE INDEX idx_returns_created_at ON returns (created_at);

COMMENT ON TABLE returns IS 'Return transactions referencing original sales. Each return has a unique return number derived from the original ticket.';

-- ─── Return Lines ────────────────────────────────────────────────────────────

CREATE TABLE return_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id       UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_line_id    UUID NOT NULL REFERENCES sale_lines(id),
  variant_id      UUID NOT NULL REFERENCES product_variants(id),
  quantity        INTEGER NOT NULL,
  refund_amount   NUMERIC(10, 2) NOT NULL,

  -- Constraints
  CONSTRAINT return_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT return_lines_refund_amount_non_negative CHECK (refund_amount >= 0)
);

-- Indexes
CREATE INDEX idx_return_lines_return_id ON return_lines (return_id);
CREATE INDEX idx_return_lines_sale_line_id ON return_lines (sale_line_id);
CREATE INDEX idx_return_lines_variant_id ON return_lines (variant_id);

COMMENT ON TABLE return_lines IS 'Individual line items within a return. References the original sale line and variant for traceability.';
