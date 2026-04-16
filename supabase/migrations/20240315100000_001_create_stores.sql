-- Migration 001: Create stores table
-- Requirements: 1.1, 7.4, 8.4

-- Enable pgcrypto for gen_random_uuid() if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Stores ──────────────────────────────────────────────────────────────────

CREATE TABLE stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  address     TEXT NOT NULL,
  phone       TEXT NOT NULL,
  tax_id      TEXT NOT NULL,
  logo_url    TEXT,
  return_policy_text TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT stores_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT stores_code_not_empty CHECK (char_length(code) > 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_stores_code ON stores (code);
CREATE INDEX idx_stores_is_active ON stores (is_active);

-- Comment
COMMENT ON TABLE stores IS 'Physical store locations in the shoe store chain';
