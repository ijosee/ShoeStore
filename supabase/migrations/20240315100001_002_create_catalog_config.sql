-- Migration 002: Create catalog configuration tables (sizes, colors, categories, brands)
-- Requirements: 2.1, 1.1

-- ─── Sizes ───────────────────────────────────────────────────────────────────

CREATE TABLE sizes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,

  -- Constraints
  CONSTRAINT sizes_value_not_empty CHECK (char_length(value) > 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_sizes_value ON sizes (value);
CREATE INDEX idx_sizes_sort_order ON sizes (sort_order);

COMMENT ON TABLE sizes IS 'Configurable shoe sizes (e.g., 22, 22.5, 23, ..., 31)';

-- ─── Colors ──────────────────────────────────────────────────────────────────

CREATE TABLE colors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  hex_code    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,

  -- Constraints
  CONSTRAINT colors_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT colors_hex_code_format CHECK (hex_code ~ '^#[0-9A-Fa-f]{6}$')
);

-- Indexes
CREATE UNIQUE INDEX idx_colors_name ON colors (name);
CREATE INDEX idx_colors_sort_order ON colors (sort_order);

COMMENT ON TABLE colors IS 'Configurable product colors with hex codes for display';

-- ─── Categories ──────────────────────────────────────────────────────────────

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,

  -- Constraints
  CONSTRAINT categories_name_not_empty CHECK (char_length(name) > 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_categories_name ON categories (name);
CREATE INDEX idx_categories_is_active ON categories (is_active);

COMMENT ON TABLE categories IS 'Product categories (e.g., Formal, Deportivo, Casual)';

-- ─── Brands ──────────────────────────────────────────────────────────────────

CREATE TABLE brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,

  -- Constraints
  CONSTRAINT brands_name_not_empty CHECK (char_length(name) > 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_brands_name ON brands (name);
CREATE INDEX idx_brands_is_active ON brands (is_active);

COMMENT ON TABLE brands IS 'Product brands managed by Admin';
