-- Migration 005: Create catalog tables (products, product_images, product_variants)
-- Requirements: 1.1, 1.3, 1.5, 1.6, 1.7, 2.2, 2.3

-- ─── Products ────────────────────────────────────────────────────────────────

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  brand_id        UUID NOT NULL REFERENCES brands(id),
  category_id     UUID NOT NULL REFERENCES categories(id),
  description     TEXT,
  base_price      NUMERIC(10, 2) NOT NULL,
  cost            NUMERIC(10, 2) NOT NULL,
  tax_rate        NUMERIC(5, 4) NOT NULL DEFAULT 0.16,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID NOT NULL REFERENCES users(id),
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT products_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT products_name_max_length CHECK (char_length(name) <= 200),
  CONSTRAINT products_description_max_length CHECK (description IS NULL OR char_length(description) <= 5000),
  CONSTRAINT products_base_price_non_negative CHECK (base_price >= 0),
  CONSTRAINT products_cost_non_negative CHECK (cost >= 0),
  CONSTRAINT products_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 1)
);

-- Indexes
CREATE INDEX idx_products_brand_id ON products (brand_id);
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_is_active ON products (is_active);
CREATE INDEX idx_products_created_by ON products (created_by);
CREATE INDEX idx_products_created_at ON products (created_at);
CREATE INDEX idx_products_search_vector ON products USING GIN (search_vector);

-- Full-text search trigger: auto-update search_vector from name
CREATE OR REPLACE FUNCTION products_search_vector_update()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.search_vector := to_tsvector('spanish', COALESCE(NEW.name, ''));
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_search_vector
  BEFORE INSERT OR UPDATE OF name ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

COMMENT ON TABLE products IS 'Base product catalog. Each product has variants (size/color combinations) with independent stock.';

-- ─── Product Images ──────────────────────────────────────────────────────────

CREATE TABLE product_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color           TEXT,
  image_url       TEXT NOT NULL,
  thumbnail_url   TEXT,
  optimized_url   TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT product_images_image_url_not_empty CHECK (char_length(image_url) > 0)
);

-- Indexes
CREATE INDEX idx_product_images_product_id ON product_images (product_id);
CREATE INDEX idx_product_images_is_primary ON product_images (product_id, is_primary);
CREATE INDEX idx_product_images_sort_order ON product_images (product_id, sort_order);

COMMENT ON TABLE product_images IS 'Product photos with optional color association. Supports thumbnail and optimized versions.';

-- ─── Product Variants ────────────────────────────────────────────────────────

CREATE TABLE product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_id         UUID NOT NULL REFERENCES sizes(id),
  color_id        UUID NOT NULL REFERENCES colors(id),
  sku             TEXT NOT NULL,
  barcode         TEXT,
  price_override  NUMERIC(10, 2),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT product_variants_sku_not_empty CHECK (char_length(sku) > 0),
  CONSTRAINT product_variants_price_override_non_negative CHECK (price_override IS NULL OR price_override >= 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_product_variants_sku ON product_variants (sku);
CREATE UNIQUE INDEX idx_product_variants_barcode ON product_variants (barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX idx_product_variants_product_size_color ON product_variants (product_id, size_id, color_id);
CREATE INDEX idx_product_variants_product_id ON product_variants (product_id);
CREATE INDEX idx_product_variants_size_id ON product_variants (size_id);
CREATE INDEX idx_product_variants_color_id ON product_variants (color_id);
CREATE INDEX idx_product_variants_is_active ON product_variants (is_active);

COMMENT ON TABLE product_variants IS 'Product variants by size/color combination. Each variant has its own SKU, optional barcode, and independent stock per store.';
