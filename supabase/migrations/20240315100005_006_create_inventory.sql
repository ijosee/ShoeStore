-- Migration 006: Create inventory tables (stock_levels, stock_movements, stock_transfers, transfer_lines, stock_adjustments)
-- Requirements: 3.1, 3.4, 3.6, 3.8, 4.1, 4.2, 4.4

-- ─── ENUM Types ──────────────────────────────────────────────────────────────

CREATE TYPE movement_type AS ENUM (
  'entry',
  'sale',
  'return',
  'adjustment',
  'transfer_out',
  'transfer_in'
);

CREATE TYPE transfer_status AS ENUM (
  'pending',
  'confirmed',
  'cancelled'
);

CREATE TYPE adjustment_reason AS ENUM (
  'physical_count',
  'damage',
  'theft_loss',
  'system_error',
  'other'
);

CREATE TYPE reference_type AS ENUM (
  'sale',
  'return',
  'transfer',
  'adjustment',
  'entry'
);

-- ─── Stock Levels ────────────────────────────────────────────────────────────

CREATE TABLE stock_levels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id          UUID NOT NULL REFERENCES product_variants(id),
  store_id            UUID NOT NULL REFERENCES stores(id),
  quantity            INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT stock_levels_quantity_non_negative CHECK (quantity >= 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_stock_levels_variant_store ON stock_levels (variant_id, store_id);
CREATE INDEX idx_stock_levels_store_id ON stock_levels (store_id);
CREATE INDEX idx_stock_levels_quantity ON stock_levels (quantity);

COMMENT ON TABLE stock_levels IS 'Current stock quantity per product variant per store. Enforces non-negative stock via CHECK constraint.';

-- ─── Stock Movements ─────────────────────────────────────────────────────────

CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id      UUID NOT NULL REFERENCES product_variants(id),
  store_id        UUID NOT NULL REFERENCES stores(id),
  movement_type   movement_type NOT NULL,
  quantity         INTEGER NOT NULL,
  stock_before    INTEGER NOT NULL,
  stock_after     INTEGER NOT NULL,
  reference_type  reference_type,
  reference_id    UUID,
  note            TEXT,
  user_id         UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_stock_movements_variant_store ON stock_movements (variant_id, store_id);
CREATE INDEX idx_stock_movements_store_created ON stock_movements (store_id, created_at);
CREATE INDEX idx_stock_movements_movement_type ON stock_movements (movement_type);
CREATE INDEX idx_stock_movements_reference ON stock_movements (reference_type, reference_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements (created_at);
CREATE INDEX idx_stock_movements_user_id ON stock_movements (user_id);

COMMENT ON TABLE stock_movements IS 'Audit trail of all stock changes (kardex). Each movement records before/after quantities and the source document.';

-- ─── Stock Transfers ─────────────────────────────────────────────────────────

CREATE TABLE stock_transfers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number       TEXT NOT NULL,
  source_store_id       UUID NOT NULL REFERENCES stores(id),
  destination_store_id  UUID NOT NULL REFERENCES stores(id),
  status                transfer_status NOT NULL DEFAULT 'pending',
  note                  TEXT,
  created_by            UUID NOT NULL REFERENCES users(id),
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_stock_transfers_number ON stock_transfers (transfer_number);
CREATE INDEX idx_stock_transfers_source ON stock_transfers (source_store_id);
CREATE INDEX idx_stock_transfers_destination ON stock_transfers (destination_store_id);
CREATE INDEX idx_stock_transfers_status ON stock_transfers (status);

COMMENT ON TABLE stock_transfers IS 'Inter-store stock transfers. Each transfer moves product variants from a source store to a destination store.';

-- ─── Transfer Lines ──────────────────────────────────────────────────────────

CREATE TABLE transfer_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id   UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  variant_id    UUID NOT NULL REFERENCES product_variants(id),
  quantity      INTEGER NOT NULL,

  -- Constraints
  CONSTRAINT transfer_lines_quantity_positive CHECK (quantity > 0)
);

-- Indexes
CREATE INDEX idx_transfer_lines_transfer_id ON transfer_lines (transfer_id);

COMMENT ON TABLE transfer_lines IS 'Individual line items within a stock transfer, specifying which variant and how many units to move.';

-- ─── Stock Adjustments ───────────────────────────────────────────────────────

CREATE TABLE stock_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id      UUID NOT NULL REFERENCES product_variants(id),
  store_id        UUID NOT NULL REFERENCES stores(id),
  quantity_before INTEGER NOT NULL,
  quantity_after  INTEGER NOT NULL,
  reason          adjustment_reason NOT NULL,
  note            TEXT NOT NULL,
  adjusted_by     UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT stock_adjustments_note_not_empty CHECK (char_length(note) > 0)
);

-- Indexes
CREATE INDEX idx_stock_adjustments_variant_store ON stock_adjustments (variant_id, store_id);
CREATE INDEX idx_stock_adjustments_adjusted_by ON stock_adjustments (adjusted_by);
CREATE INDEX idx_stock_adjustments_created_at ON stock_adjustments (created_at);

COMMENT ON TABLE stock_adjustments IS 'Records of manual stock adjustments with mandatory reason and note for audit purposes.';
