-- Migration 003: Create payment_methods table
-- Requirements: 7.1, 7.4

-- ─── Payment Methods ─────────────────────────────────────────────────────────

CREATE TABLE payment_methods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  icon        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT payment_methods_name_not_empty CHECK (char_length(name) > 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_payment_methods_name ON payment_methods (name);
CREATE INDEX idx_payment_methods_is_active ON payment_methods (is_active);
CREATE INDEX idx_payment_methods_sort_order ON payment_methods (sort_order);

COMMENT ON TABLE payment_methods IS 'Configurable payment methods (Efectivo, Tarjeta de Crédito, etc.)';
