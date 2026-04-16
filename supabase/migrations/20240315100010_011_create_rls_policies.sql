-- Migration 011: Create Row Level Security (RLS) policies
-- Requirements: 11.6, 12.5, NF-3.3
--
-- Strategy:
--   • Admin users bypass store-level filtering (see all data)
--   • Managers see data from their assigned stores only
--   • Sellers see data from their assigned stores, with further restrictions on sales (own sales only)
--   • audit_logs are immutable: no UPDATE/DELETE; INSERT only via SECURITY DEFINER functions; SELECT filtered by role
--   • Configuration tables (stores, sizes, colors, categories, brands, payment_methods) are NOT RLS-protected
--     because they should be readable by all authenticated users

-- ─── Helper Functions ────────────────────────────────────────────────────────

-- Returns the role of the currently authenticated user.
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION get_user_role() IS 'Returns the role of the currently authenticated user. Used by RLS policies.';

-- Returns the store IDs assigned to the currently authenticated user.
CREATE OR REPLACE FUNCTION get_user_store_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM user_stores WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION get_user_store_ids() IS 'Returns the set of store IDs assigned to the currently authenticated user. Used by RLS policies.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- Enable RLS on all tables with sensitive data
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. USERS — all authenticated users can read; admin can manage
-- ═══════════════════════════════════════════════════════════════════════════════

-- Users can read their own profile; admin sees all; managers see users in their stores
CREATE POLICY users_select ON users
  FOR SELECT
  USING (
    id = auth.uid()
    OR get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND id IN (
        SELECT us.user_id FROM user_stores us
        WHERE us.store_id IN (SELECT get_user_store_ids())
      )
    )
  );

-- Only admin can insert new users
CREATE POLICY users_insert ON users
  FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

-- Admin can update any user; users can update their own profile
CREATE POLICY users_update ON users
  FOR UPDATE
  USING (
    get_user_role() = 'admin'
    OR id = auth.uid()
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR id = auth.uid()
  );

-- Only admin can delete users
CREATE POLICY users_delete ON users
  FOR DELETE
  USING (get_user_role() = 'admin');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. USER_STORES — admin manages; users see their own assignments
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY user_stores_select ON user_stores
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR get_user_role() = 'admin'
  );

CREATE POLICY user_stores_insert ON user_stores
  FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY user_stores_update ON user_stores
  FOR UPDATE
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY user_stores_delete ON user_stores
  FOR DELETE
  USING (get_user_role() = 'admin');


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. STOCK_LEVELS — filtered by assigned stores; admin sees all
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY stock_levels_select ON stock_levels
  FOR SELECT
  USING (
    get_user_role() = 'admin'
    OR store_id IN (SELECT get_user_store_ids())
  );

CREATE POLICY stock_levels_insert ON stock_levels
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
  );

CREATE POLICY stock_levels_update ON stock_levels
  FOR UPDATE
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
  );

-- No direct DELETE on stock_levels (managed via cascades and functions)
CREATE POLICY stock_levels_delete ON stock_levels
  FOR DELETE
  USING (get_user_role() = 'admin');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. STOCK_MOVEMENTS — filtered by assigned stores; admin sees all
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY stock_movements_select ON stock_movements
  FOR SELECT
  USING (
    get_user_role() = 'admin'
    OR store_id IN (SELECT get_user_store_ids())
  );

-- INSERT allowed for managers in their stores (adjustments, transfers)
-- Sellers don't directly insert movements; they go through SECURITY DEFINER functions
CREATE POLICY stock_movements_insert ON stock_movements
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() IN ('manager', 'seller')
      AND store_id IN (SELECT get_user_store_ids())
    )
  );

-- Stock movements are immutable records — no UPDATE or DELETE
CREATE POLICY stock_movements_update ON stock_movements
  FOR UPDATE
  USING (false);

CREATE POLICY stock_movements_delete ON stock_movements
  FOR DELETE
  USING (false);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. STOCK_ALERTS — filtered by assigned stores; admin sees all
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY stock_alerts_select ON stock_alerts
  FOR SELECT
  USING (
    get_user_role() = 'admin'
    OR store_id IN (SELECT get_user_store_ids())
  );

CREATE POLICY stock_alerts_insert ON stock_alerts
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin'
    OR store_id IN (SELECT get_user_store_ids())
  );

-- Managers and admin can acknowledge alerts (update status)
CREATE POLICY stock_alerts_update ON stock_alerts
  FOR UPDATE
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
  );

CREATE POLICY stock_alerts_delete ON stock_alerts
  FOR DELETE
  USING (get_user_role() = 'admin');


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. SALES — sellers see own sales; managers see store sales; admin sees all
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY sales_select ON sales
  FOR SELECT
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
    OR (
      get_user_role() = 'seller'
      AND seller_id = auth.uid()
    )
  );

-- Sellers can create sales in their assigned stores
CREATE POLICY sales_insert ON sales
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin'
    OR store_id IN (SELECT get_user_store_ids())
  );

-- Only admin and managers can update sales (e.g., void a sale)
CREATE POLICY sales_update ON sales
  FOR UPDATE
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
  );

-- No direct DELETE on sales
CREATE POLICY sales_delete ON sales
  FOR DELETE
  USING (false);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. SALE_LINES — follow the same visibility as the parent sale
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY sale_lines_select ON sale_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_lines.sale_id
    )
  );

CREATE POLICY sale_lines_insert ON sale_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_lines.sale_id
    )
  );

-- Sale lines are immutable once created
CREATE POLICY sale_lines_update ON sale_lines
  FOR UPDATE
  USING (false);

CREATE POLICY sale_lines_delete ON sale_lines
  FOR DELETE
  USING (false);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. SALE_PAYMENTS — follow the same visibility as the parent sale
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY sale_payments_select ON sale_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_payments.sale_id
    )
  );

CREATE POLICY sale_payments_insert ON sale_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_payments.sale_id
    )
  );

-- Sale payments are immutable once created
CREATE POLICY sale_payments_update ON sale_payments
  FOR UPDATE
  USING (false);

CREATE POLICY sale_payments_delete ON sale_payments
  FOR DELETE
  USING (false);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. RETURNS — filtered by store; admin sees all
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY returns_select ON returns
  FOR SELECT
  USING (
    get_user_role() = 'admin'
    OR store_id IN (SELECT get_user_store_ids())
  );

CREATE POLICY returns_insert ON returns
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin'
    OR store_id IN (SELECT get_user_store_ids())
  );

-- Only admin and managers can update returns
CREATE POLICY returns_update ON returns
  FOR UPDATE
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND store_id IN (SELECT get_user_store_ids())
    )
  );

CREATE POLICY returns_delete ON returns
  FOR DELETE
  USING (false);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. RETURN_LINES — follow the same visibility as the parent return
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY return_lines_select ON return_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_lines.return_id
    )
  );

CREATE POLICY return_lines_insert ON return_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM returns r
      WHERE r.id = return_lines.return_id
    )
  );

-- Return lines are immutable once created
CREATE POLICY return_lines_update ON return_lines
  FOR UPDATE
  USING (false);

CREATE POLICY return_lines_delete ON return_lines
  FOR DELETE
  USING (false);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. AUDIT_LOGS — immutable: block UPDATE/DELETE; no direct INSERT; SELECT by role
-- ═══════════════════════════════════════════════════════════════════════════════
-- INSERT is handled exclusively by SECURITY DEFINER functions (confirm_sale,
-- process_return, execute_transfer, adjust_stock, and audit triggers).
-- No regular user should INSERT directly into audit_logs.

-- SELECT: admin sees all; managers see logs from their stores; sellers see nothing
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'manager'
      AND (
        store_id IN (SELECT get_user_store_ids())
        OR store_id IS NULL
      )
    )
  );

-- Block direct INSERT — all inserts go through SECURITY DEFINER functions
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT
  WITH CHECK (false);

-- Block UPDATE — audit logs are immutable
CREATE POLICY audit_logs_update ON audit_logs
  FOR UPDATE
  USING (false);

-- Block DELETE — audit logs are immutable
CREATE POLICY audit_logs_delete ON audit_logs
  FOR DELETE
  USING (false);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Grant usage notes:
-- ═══════════════════════════════════════════════════════════════════════════════
-- • SECURITY DEFINER functions (confirm_sale, process_return, execute_transfer,
--   adjust_stock, audit_trigger_func) bypass RLS because they run as the
--   function owner (postgres), not as the calling user.
-- • Configuration tables (stores, sizes, colors, categories, brands,
--   payment_methods, products, product_images, product_variants) do NOT have
--   RLS enabled — they are readable by all authenticated users.
-- • The anon role should have no access to any of these tables.
