-- Migration 012: Create audit triggers and stock threshold trigger
-- Requirements: 12.1, 12.2, 13.1
--
-- This migration creates:
--   1. audit_trigger_func()          — generic SECURITY DEFINER trigger function
--                                      that logs INSERT/UPDATE/DELETE to audit_logs
--   2. check_stock_threshold_func()  — trigger function that creates/updates
--                                      stock_alerts when stock falls at or below threshold
--   3. AFTER triggers on audited tables
--   4. AFTER UPDATE trigger on stock_levels

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Generic Audit Trigger Function
-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER so it can bypass RLS on audit_logs (which blocks direct INSERT).
-- Captures:
--   • action_type  — INSERT / UPDATE / DELETE
--   • entity_type  — TG_TABLE_NAME
--   • entity_id    — NEW.id or OLD.id
--   • user_id      — auth.uid() (may be NULL for system/migration operations)
--   • store_id     — extracted from the row if the table has a store_id column
--   • old_values    — row_to_json(OLD) for UPDATE/DELETE
--   • new_values    — row_to_json(NEW) for INSERT/UPDATE

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_audit_trigger$
DECLARE
  v_user_id    UUID;
  v_action     TEXT;
  v_entity_id  TEXT;
  v_store_id   UUID := NULL;
  v_old_values JSONB := NULL;
  v_new_values JSONB := NULL;
  v_new_json   JSONB;
  v_old_json   JSONB;
BEGIN
  -- Determine the current user (may be NULL for system operations)
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Determine action type
  v_action := TG_OP;

  -- Build JSON representations and extract entity_id / store_id
  IF TG_OP = 'DELETE' THEN
    v_old_json := row_to_json(OLD)::JSONB;
    v_entity_id := v_old_json->>'id';
    v_old_values := v_old_json;

    -- Try to get store_id from OLD row
    IF v_old_json ? 'store_id' AND v_old_json->>'store_id' IS NOT NULL THEN
      v_store_id := (v_old_json->>'store_id')::UUID;
    END IF;

  ELSIF TG_OP = 'INSERT' THEN
    v_new_json := row_to_json(NEW)::JSONB;
    v_entity_id := v_new_json->>'id';
    v_new_values := v_new_json;

    -- Try to get store_id from NEW row
    IF v_new_json ? 'store_id' AND v_new_json->>'store_id' IS NOT NULL THEN
      v_store_id := (v_new_json->>'store_id')::UUID;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_json := row_to_json(OLD)::JSONB;
    v_new_json := row_to_json(NEW)::JSONB;
    v_entity_id := v_new_json->>'id';
    v_old_values := v_old_json;
    v_new_values := v_new_json;

    -- Try to get store_id from NEW row
    IF v_new_json ? 'store_id' AND v_new_json->>'store_id' IS NOT NULL THEN
      v_store_id := (v_new_json->>'store_id')::UUID;
    END IF;
  END IF;

  -- Insert audit log entry (bypasses RLS because SECURITY DEFINER)
  INSERT INTO audit_logs (
    id,
    user_id,
    action_type,
    entity_type,
    entity_id,
    store_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_store_id,
    v_old_values,
    v_new_values,
    now()
  );

  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$fn_audit_trigger$;

COMMENT ON FUNCTION audit_trigger_func() IS
  'Generic audit trigger function (SECURITY DEFINER). Logs INSERT/UPDATE/DELETE '
  'operations to audit_logs, capturing old/new values, user, entity, and store.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Stock Threshold Check Trigger Function
-- ═══════════════════════════════════════════════════════════════════════════════
-- After UPDATE on stock_levels, checks if the new quantity <= low_stock_threshold.
-- If so, inserts a new stock_alert or updates the current_stock on an existing
-- active alert for the same variant+store.
-- If quantity > threshold, no new alert is created.

CREATE OR REPLACE FUNCTION check_stock_threshold_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_stock_threshold$
DECLARE
  v_existing_alert_id UUID;
BEGIN
  -- Only act when quantity actually changed
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN

    IF NEW.quantity <= NEW.low_stock_threshold THEN
      -- Check if there is already an active alert for this variant+store
      SELECT id INTO v_existing_alert_id
      FROM stock_alerts
      WHERE variant_id = NEW.variant_id
        AND store_id = NEW.store_id
        AND status = 'active'
      LIMIT 1;

      IF v_existing_alert_id IS NOT NULL THEN
        -- Update existing active alert with new current_stock
        UPDATE stock_alerts
        SET current_stock = NEW.quantity,
            threshold = NEW.low_stock_threshold
        WHERE id = v_existing_alert_id;
      ELSE
        -- Create new alert
        INSERT INTO stock_alerts (
          id,
          variant_id,
          store_id,
          current_stock,
          threshold,
          status,
          created_at
        ) VALUES (
          gen_random_uuid(),
          NEW.variant_id,
          NEW.store_id,
          NEW.quantity,
          NEW.low_stock_threshold,
          'active',
          now()
        );
      END IF;

    END IF;
    -- If quantity > threshold, we do not create a new alert.
    -- Existing alerts remain as-is (they can be acknowledged manually).

  END IF;

  RETURN NEW;
END;
$fn_stock_threshold$;

COMMENT ON FUNCTION check_stock_threshold_func() IS
  'Trigger function for stock_levels. After UPDATE, checks if quantity <= threshold '
  'and creates or updates a stock_alert accordingly.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Apply Audit Triggers to Tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- Products: track creation, edits, and deletion of catalog items
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Stock Adjustments: track all manual stock adjustments
CREATE TRIGGER trg_audit_stock_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Stock Transfers: track inter-store transfers
CREATE TRIGGER trg_audit_stock_transfers
  AFTER INSERT OR UPDATE OR DELETE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Sales: track sale creation and status changes (e.g., voiding)
CREATE TRIGGER trg_audit_sales
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Returns: track return processing
CREATE TRIGGER trg_audit_returns
  AFTER INSERT OR UPDATE OR DELETE ON returns
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Users: track user creation, profile edits, and deactivation
CREATE TRIGGER trg_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Apply Stock Threshold Trigger to stock_levels
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_check_stock_threshold
  AFTER UPDATE ON stock_levels
  FOR EACH ROW EXECUTE FUNCTION check_stock_threshold_func();
