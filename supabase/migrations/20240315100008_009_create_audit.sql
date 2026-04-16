-- Migration 009: Create audit and alerts tables (audit_logs, stock_alerts)
-- Requirements: 12.1, 12.2, 12.3, 12.5, 13.1

-- ─── ENUM Types ──────────────────────────────────────────────────────────────

CREATE TYPE stock_alert_status AS ENUM ('active', 'acknowledged');

-- ─── Audit Logs ──────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  action_type     TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  store_id        UUID REFERENCES stores(id),
  old_values      JSONB,
  new_values      JSONB,
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT audit_logs_action_type_not_empty CHECK (char_length(action_type) > 0),
  CONSTRAINT audit_logs_entity_type_not_empty CHECK (char_length(entity_type) > 0),
  CONSTRAINT audit_logs_entity_id_not_empty CHECK (char_length(entity_id) > 0)
);

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs (action_type);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_store_id ON audit_logs (store_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail of all sensitive actions. Records who did what, when, and where. No user can modify or delete these records.';

-- ─── Stock Alerts ────────────────────────────────────────────────────────────

CREATE TABLE stock_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id        UUID NOT NULL REFERENCES product_variants(id),
  store_id          UUID NOT NULL REFERENCES stores(id),
  current_stock     INTEGER NOT NULL,
  threshold         INTEGER NOT NULL,
  status            stock_alert_status NOT NULL DEFAULT 'active',
  acknowledged_by   UUID REFERENCES users(id),
  acknowledged_note TEXT,
  acknowledged_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT stock_alerts_current_stock_non_negative CHECK (current_stock >= 0),
  CONSTRAINT stock_alerts_threshold_non_negative CHECK (threshold >= 0)
);

-- Indexes
CREATE INDEX idx_stock_alerts_store_status ON stock_alerts (store_id, status);
CREATE INDEX idx_stock_alerts_variant_id ON stock_alerts (variant_id);
CREATE INDEX idx_stock_alerts_created_at ON stock_alerts (created_at);

COMMENT ON TABLE stock_alerts IS 'Low stock alerts generated when a variant stock falls at or below the configured threshold. Alerts remain active until stock is replenished.';
