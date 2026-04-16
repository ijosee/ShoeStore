-- Migration 010: Create PL/pgSQL functions for atomic operations
-- Requirements: 3.2, 3.3, 4.2, 4.3, 6.9, 8.1, 8.2, 9.4

-- ─── Transfer Sequences Table ────────────────────────────────────────────────
-- Needed for atomic transfer number generation (similar to ticket_sequences)

CREATE TABLE transfer_sequences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year            INTEGER NOT NULL,
  last_sequence   INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT transfer_sequences_year_valid CHECK (year >= 2000 AND year <= 9999),
  CONSTRAINT transfer_sequences_last_sequence_non_negative CHECK (last_sequence >= 0)
);

CREATE UNIQUE INDEX idx_transfer_sequences_year ON transfer_sequences (year);

COMMENT ON TABLE transfer_sequences IS 'Atomic transfer number sequences per year. Used by next_transfer_number() to generate sequential transfer numbers.';

-- ─── Function: next_ticket_number ────────────────────────────────────────────
-- Generates the next sequential ticket number for a store/year.
-- Format: {STORE_CODE}-{YEAR}-{SEQ_6_DIGITS} (e.g., TC-2024-000142)
-- Uses INSERT ON CONFLICT for atomic sequence increment.

CREATE OR REPLACE FUNCTION next_ticket_number(p_store_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_ticket$
DECLARE
  v_store_code TEXT;
  v_year       INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_seq        INTEGER;
BEGIN
  -- Get store code
  SELECT code INTO STRICT v_store_code
  FROM stores
  WHERE id = p_store_id;

  -- Atomic increment with INSERT ON CONFLICT
  INSERT INTO ticket_sequences (id, store_id, year, last_sequence)
  VALUES (gen_random_uuid(), p_store_id, v_year, 1)
  ON CONFLICT (store_id, year)
  DO UPDATE SET last_sequence = ticket_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_seq;

  RETURN v_store_code || '-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$fn_ticket$;

COMMENT ON FUNCTION next_ticket_number(UUID) IS 'Generates the next sequential ticket number for a given store. Thread-safe via INSERT ON CONFLICT.';

-- ─── Function: next_transfer_number ──────────────────────────────────────────
-- Generates the next sequential transfer number.
-- Format: TRF-{YEAR}-{SEQ_6_DIGITS} (e.g., TRF-2024-000023)

CREATE OR REPLACE FUNCTION next_transfer_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_transfer$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_seq  INTEGER;
BEGIN
  INSERT INTO transfer_sequences (id, year, last_sequence)
  VALUES (gen_random_uuid(), v_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_sequence = transfer_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_seq;

  RETURN 'TRF-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$fn_transfer$;

COMMENT ON FUNCTION next_transfer_number() IS 'Generates the next sequential transfer number. Thread-safe via INSERT ON CONFLICT.';

-- ─── Function: confirm_sale ──────────────────────────────────────────────────
-- Atomic sale confirmation: validates stock, creates sale + lines + payments +
-- stock movements + alerts + audit in a single transaction.
--
-- Input JSONB structure:
-- {
--   "store_id": "uuid",
--   "seller_id": "uuid",
--   "lines": [{ "variant_id": "uuid", "quantity": int, "unit_price": numeric, "line_discount": numeric }],
--   "discount": { "type": "percentage"|"fixed_amount", "value": numeric } | null,
--   "payments": [{ "payment_method_id": "uuid", "amount": numeric, "amount_received": numeric|null }]
-- }

CREATE OR REPLACE FUNCTION confirm_sale(sale_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_sale$
DECLARE
  v_store_id        UUID := (sale_data->>'store_id')::UUID;
  v_seller_id       UUID := (sale_data->>'seller_id')::UUID;
  v_sale_id         UUID;
  v_ticket_number   TEXT;
  v_line            JSONB;
  v_payment         JSONB;
  v_stock_row       stock_levels%ROWTYPE;

  -- Line calculation variables
  v_variant_id      UUID;
  v_quantity        INTEGER;
  v_unit_price      NUMERIC(10, 2);
  v_line_discount   NUMERIC(10, 2);
  v_tax_rate        NUMERIC(5, 4);
  v_product_name    TEXT;
  v_variant_desc    TEXT;
  v_line_subtotal   NUMERIC(10, 2);
  v_line_tax        NUMERIC(10, 2);
  v_line_total      NUMERIC(10, 2);
  v_line_id         UUID;

  -- Sale totals
  v_raw_subtotal    NUMERIC(10, 2) := 0;
  v_discount_type   discount_type;
  v_discount_value  NUMERIC(10, 2) := 0;
  v_discount_amount NUMERIC(10, 2) := 0;
  v_sale_subtotal   NUMERIC(10, 2) := 0;
  v_sale_tax        NUMERIC(10, 2) := 0;
  v_sale_total      NUMERIC(10, 2) := 0;

  -- Discount distribution
  v_line_raw_sub    NUMERIC(10, 2);
  v_dist_discount   NUMERIC(10, 2);
  v_dist_sum        NUMERIC(10, 2) := 0;
  v_line_count      INTEGER;
  v_line_index      INTEGER := 0;

  -- Payment
  v_payment_method_id UUID;
  v_pay_amount      NUMERIC(10, 2);
  v_pay_received    NUMERIC(10, 2);
  v_pay_change      NUMERIC(10, 2);

  -- Result
  v_result          JSONB;
  v_lines_result    JSONB := '[]'::JSONB;
  v_payments_result JSONB := '[]'::JSONB;
BEGIN
  -- Count lines for discount distribution
  v_line_count := jsonb_array_length(sale_data->'lines');

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART:El carrito no puede estar vacío';
  END IF;

  -- 1. Calculate raw subtotal (before global discount)
  FOR v_line IN SELECT * FROM jsonb_array_elements(sale_data->'lines')
  LOOP
    v_raw_subtotal := v_raw_subtotal +
      ((v_line->>'unit_price')::NUMERIC(10,2) * (v_line->>'quantity')::INTEGER);
  END LOOP;

  -- 2. Calculate global discount amount
  IF sale_data->'discount' IS NOT NULL AND sale_data->>'discount' != 'null' THEN
    v_discount_type := (sale_data->'discount'->>'type')::discount_type;
    v_discount_value := (sale_data->'discount'->>'value')::NUMERIC(10,2);

    IF v_discount_type = 'percentage' THEN
      v_discount_amount := ROUND(v_raw_subtotal * (v_discount_value / 100), 2);
    ELSE
      v_discount_amount := v_discount_value;
    END IF;
  END IF;

  -- 3. Generate ticket number
  v_ticket_number := next_ticket_number(v_store_id);

  -- 4. Create sale record (totals will be updated after line processing)
  INSERT INTO sales (
    id, ticket_number, store_id, seller_id,
    subtotal, discount_amount, discount_type, discount_value,
    tax_amount, total, status
  ) VALUES (
    gen_random_uuid(), v_ticket_number, v_store_id, v_seller_id,
    0, v_discount_amount, v_discount_type, v_discount_value,
    0, 0, 'completed'
  ) RETURNING id INTO v_sale_id;

  -- 5. Process each line
  v_line_index := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(sale_data->'lines')
  LOOP
    v_line_index := v_line_index + 1;
    v_variant_id := (v_line->>'variant_id')::UUID;
    v_quantity := (v_line->>'quantity')::INTEGER;
    v_unit_price := (v_line->>'unit_price')::NUMERIC(10,2);

    -- Get product info for snapshot
    SELECT
      p.name,
      s.value || '-' || c.name,
      p.tax_rate
    INTO v_product_name, v_variant_desc, v_tax_rate
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    JOIN sizes s ON s.id = pv.size_id
    JOIN colors c ON c.id = pv.color_id
    WHERE pv.id = v_variant_id;

    -- Lock stock row (pessimistic locking)
    SELECT * INTO v_stock_row
    FROM stock_levels
    WHERE variant_id = v_variant_id
      AND store_id = v_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_NOT_FOUND:No se encontró registro de stock para variante % en tienda %',
        v_variant_id, v_store_id;
    END IF;

    -- Validate sufficient stock
    IF v_stock_row.quantity < v_quantity THEN
      RAISE EXCEPTION 'STOCK_INSUFFICIENT:Variante % tiene % disponibles, se requieren %',
        v_variant_id, v_stock_row.quantity, v_quantity;
    END IF;

    -- Calculate line discount (proportional distribution of global discount)
    v_line_raw_sub := v_unit_price * v_quantity;
    IF v_line_index < v_line_count THEN
      v_dist_discount := ROUND(v_discount_amount * (v_line_raw_sub / v_raw_subtotal), 2);
      v_dist_sum := v_dist_sum + v_dist_discount;
    ELSE
      -- Last line gets the remainder to avoid penny loss
      v_dist_discount := v_discount_amount - v_dist_sum;
    END IF;

    -- Add per-line discount from input
    v_line_discount := COALESCE((v_line->>'line_discount')::NUMERIC(10,2), 0) + v_dist_discount;

    -- Calculate line totals
    v_line_subtotal := (v_unit_price * v_quantity) - v_line_discount;
    v_line_tax := ROUND(v_line_subtotal * v_tax_rate, 2);
    v_line_total := v_line_subtotal + v_line_tax;

    -- Accumulate sale totals
    v_sale_subtotal := v_sale_subtotal + v_line_subtotal;
    v_sale_tax := v_sale_tax + v_line_tax;
    v_sale_total := v_sale_total + v_line_total;

    -- Insert sale line
    INSERT INTO sale_lines (
      id, sale_id, variant_id, product_name, variant_description,
      quantity, unit_price, line_discount, tax_rate,
      line_subtotal, line_tax, line_total
    ) VALUES (
      gen_random_uuid(), v_sale_id, v_variant_id, v_product_name, v_variant_desc,
      v_quantity, v_unit_price, v_line_discount, v_tax_rate,
      v_line_subtotal, v_line_tax, v_line_total
    ) RETURNING id INTO v_line_id;

    -- Deduct stock
    UPDATE stock_levels
    SET quantity = quantity - v_quantity,
        updated_at = now()
    WHERE id = v_stock_row.id;

    -- Record stock movement
    INSERT INTO stock_movements (
      id, variant_id, store_id, movement_type, quantity,
      stock_before, stock_after, reference_type, reference_id,
      user_id, created_at
    ) VALUES (
      gen_random_uuid(), v_variant_id, v_store_id, 'sale', -v_quantity,
      v_stock_row.quantity, v_stock_row.quantity - v_quantity,
      'sale', v_sale_id, v_seller_id, now()
    );

    -- Check low stock threshold and create alert if needed
    IF (v_stock_row.quantity - v_quantity) <= v_stock_row.low_stock_threshold THEN
      INSERT INTO stock_alerts (
        id, variant_id, store_id, current_stock, threshold, status
      ) VALUES (
        gen_random_uuid(), v_variant_id, v_store_id,
        v_stock_row.quantity - v_quantity, v_stock_row.low_stock_threshold, 'active'
      )
      ON CONFLICT ON CONSTRAINT stock_alerts_pkey DO NOTHING;
    END IF;

    -- Build line result
    v_lines_result := v_lines_result || jsonb_build_object(
      'id', v_line_id,
      'variant_id', v_variant_id,
      'product_name', v_product_name,
      'variant_description', v_variant_desc,
      'quantity', v_quantity,
      'unit_price', v_unit_price,
      'line_discount', v_line_discount,
      'tax_rate', v_tax_rate,
      'line_subtotal', v_line_subtotal,
      'line_tax', v_line_tax,
      'line_total', v_line_total
    );
  END LOOP;

  -- 6. Update sale totals
  UPDATE sales
  SET subtotal = v_sale_subtotal,
      tax_amount = v_sale_tax,
      total = v_sale_total
  WHERE id = v_sale_id;

  -- 7. Process payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(sale_data->'payments')
  LOOP
    v_payment_method_id := (v_payment->>'payment_method_id')::UUID;
    v_pay_amount := (v_payment->>'amount')::NUMERIC(10,2);
    v_pay_received := CASE
      WHEN v_payment->>'amount_received' IS NOT NULL
        THEN (v_payment->>'amount_received')::NUMERIC(10,2)
      ELSE NULL
    END;
    v_pay_change := CASE
      WHEN v_pay_received IS NOT NULL
        THEN v_pay_received - v_pay_amount
      ELSE NULL
    END;

    INSERT INTO sale_payments (
      id, sale_id, payment_method_id, amount, amount_received, change_amount
    ) VALUES (
      gen_random_uuid(), v_sale_id, v_payment_method_id,
      v_pay_amount, v_pay_received, v_pay_change
    );

    v_payments_result := v_payments_result || jsonb_build_object(
      'payment_method_id', v_payment_method_id,
      'amount', v_pay_amount,
      'amount_received', v_pay_received,
      'change_amount', v_pay_change
    );
  END LOOP;

  -- 8. Audit log
  INSERT INTO audit_logs (
    id, user_id, action_type, entity_type, entity_id,
    store_id, new_values, created_at
  ) VALUES (
    gen_random_uuid(), v_seller_id, 'sale_confirmed', 'sale', v_sale_id::TEXT,
    v_store_id,
    jsonb_build_object(
      'ticket_number', v_ticket_number,
      'total', v_sale_total,
      'line_count', v_line_count
    ),
    now()
  );

  -- 9. Build result
  v_result := jsonb_build_object(
    'sale_id', v_sale_id,
    'ticket_number', v_ticket_number,
    'store_id', v_store_id,
    'seller_id', v_seller_id,
    'lines', v_lines_result,
    'subtotal', v_sale_subtotal,
    'discount_amount', v_discount_amount,
    'discount_type', v_discount_type,
    'discount_value', v_discount_value,
    'tax_amount', v_sale_tax,
    'total', v_sale_total,
    'payments', v_payments_result,
    'status', 'completed',
    'created_at', now()
  );

  RETURN v_result;
END;
$fn_sale$;

COMMENT ON FUNCTION confirm_sale(JSONB) IS 'Atomic sale confirmation: validates stock (SELECT FOR UPDATE), creates sale + lines + payments + stock movements + alerts + audit.';

-- ─── Function: process_return ────────────────────────────────────────────────
-- Atomic return processing: validates original sale, calculates proportional
-- refund, re-stocks items, creates return + lines + movements + audit.
--
-- Input JSONB structure:
-- {
--   "original_sale_id": "uuid",
--   "store_id": "uuid",
--   "processed_by": "uuid",
--   "reason": "factory_defect"|"wrong_size"|"not_satisfied"|"transport_damage"|"other",
--   "reason_note": "text" | null,
--   "lines": [{ "sale_line_id": "uuid", "variant_id": "uuid", "quantity": int }]
-- }

CREATE OR REPLACE FUNCTION process_return(return_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_return$
DECLARE
  v_original_sale_id UUID := (return_data->>'original_sale_id')::UUID;
  v_store_id         UUID := (return_data->>'store_id')::UUID;
  v_processed_by     UUID := (return_data->>'processed_by')::UUID;
  v_reason           return_reason := (return_data->>'reason')::return_reason;
  v_reason_note      TEXT := return_data->>'reason_note';

  v_sale_row         sales%ROWTYPE;
  v_return_id        UUID;
  v_return_number    TEXT;
  v_total_refund     NUMERIC(10, 2) := 0;

  v_line             JSONB;
  v_sale_line_id     UUID;
  v_variant_id       UUID;
  v_return_qty       INTEGER;
  v_sale_line_row    sale_lines%ROWTYPE;
  v_line_refund      NUMERIC(10, 2);
  v_stock_row        stock_levels%ROWTYPE;

  -- Return sequence counter
  v_return_seq       INTEGER;

  -- Result
  v_result           JSONB;
  v_lines_result     JSONB := '[]'::JSONB;
BEGIN
  -- 1. Validate original sale exists and is not voided
  SELECT * INTO v_sale_row
  FROM sales
  WHERE id = v_original_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND:No se encontró la venta con ID %', v_original_sale_id;
  END IF;

  IF v_sale_row.status = 'voided' THEN
    RAISE EXCEPTION 'SALE_ALREADY_VOIDED:La venta % ya fue anulada', v_sale_row.ticket_number;
  END IF;

  -- 2. Generate return number: DEV-{ORIGINAL_TICKET}-{SEQ_2_DIGITS}
  SELECT COUNT(*) + 1 INTO v_return_seq
  FROM returns
  WHERE original_sale_id = v_original_sale_id;

  v_return_number := 'DEV-' || v_sale_row.ticket_number || '-' || LPAD(v_return_seq::TEXT, 2, '0');

  -- 3. Create return record (refund_amount updated after line processing)
  INSERT INTO returns (
    id, return_number, original_sale_id, store_id,
    processed_by, reason, reason_note, refund_amount, status
  ) VALUES (
    gen_random_uuid(), v_return_number, v_original_sale_id, v_store_id,
    v_processed_by, v_reason, v_reason_note, 0, 'completed'
  ) RETURNING id INTO v_return_id;

  -- 4. Process each return line
  FOR v_line IN SELECT * FROM jsonb_array_elements(return_data->'lines')
  LOOP
    v_sale_line_id := (v_line->>'sale_line_id')::UUID;
    v_variant_id := (v_line->>'variant_id')::UUID;
    v_return_qty := (v_line->>'quantity')::INTEGER;

    -- Get original sale line
    SELECT * INTO v_sale_line_row
    FROM sale_lines
    WHERE id = v_sale_line_id
      AND sale_id = v_original_sale_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SALE_LINE_NOT_FOUND:Línea de venta % no encontrada en la venta %',
        v_sale_line_id, v_original_sale_id;
    END IF;

    -- Validate return quantity does not exceed sold quantity
    IF v_return_qty > v_sale_line_row.quantity THEN
      RAISE EXCEPTION 'RETURN_EXCEEDS_QUANTITY:No se puede devolver % unidades, solo se vendieron %',
        v_return_qty, v_sale_line_row.quantity;
    END IF;

    -- Calculate proportional refund
    v_line_refund := ROUND(
      v_sale_line_row.line_total * (v_return_qty::NUMERIC / v_sale_line_row.quantity::NUMERIC), 2
    );
    v_total_refund := v_total_refund + v_line_refund;

    -- Insert return line
    INSERT INTO return_lines (
      id, return_id, sale_line_id, variant_id, quantity, refund_amount
    ) VALUES (
      gen_random_uuid(), v_return_id, v_sale_line_id, v_variant_id,
      v_return_qty, v_line_refund
    );

    -- Re-stock: lock and update stock_levels
    SELECT * INTO v_stock_row
    FROM stock_levels
    WHERE variant_id = v_variant_id
      AND store_id = v_store_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE stock_levels
      SET quantity = quantity + v_return_qty,
          updated_at = now()
      WHERE id = v_stock_row.id;

      -- Record stock movement
      INSERT INTO stock_movements (
        id, variant_id, store_id, movement_type, quantity,
        stock_before, stock_after, reference_type, reference_id,
        user_id, created_at
      ) VALUES (
        gen_random_uuid(), v_variant_id, v_store_id, 'return', v_return_qty,
        v_stock_row.quantity, v_stock_row.quantity + v_return_qty,
        'return', v_return_id, v_processed_by, now()
      );
    ELSE
      -- If no stock_level row exists, create one
      INSERT INTO stock_levels (id, variant_id, store_id, quantity, updated_at)
      VALUES (gen_random_uuid(), v_variant_id, v_store_id, v_return_qty, now());

      INSERT INTO stock_movements (
        id, variant_id, store_id, movement_type, quantity,
        stock_before, stock_after, reference_type, reference_id,
        user_id, created_at
      ) VALUES (
        gen_random_uuid(), v_variant_id, v_store_id, 'return', v_return_qty,
        0, v_return_qty,
        'return', v_return_id, v_processed_by, now()
      );
    END IF;

    -- Build line result
    v_lines_result := v_lines_result || jsonb_build_object(
      'sale_line_id', v_sale_line_id,
      'variant_id', v_variant_id,
      'product_name', v_sale_line_row.product_name,
      'variant_description', v_sale_line_row.variant_description,
      'quantity', v_return_qty,
      'refund_amount', v_line_refund
    );
  END LOOP;

  -- 5. Update return total refund
  UPDATE returns
  SET refund_amount = v_total_refund
  WHERE id = v_return_id;

  -- 6. Audit log
  INSERT INTO audit_logs (
    id, user_id, action_type, entity_type, entity_id,
    store_id, new_values, created_at
  ) VALUES (
    gen_random_uuid(), v_processed_by, 'return_processed', 'return', v_return_id::TEXT,
    v_store_id,
    jsonb_build_object(
      'return_number', v_return_number,
      'original_ticket', v_sale_row.ticket_number,
      'refund_amount', v_total_refund
    ),
    now()
  );

  -- 7. Build result
  v_result := jsonb_build_object(
    'return_id', v_return_id,
    'return_number', v_return_number,
    'original_sale_id', v_original_sale_id,
    'original_ticket_number', v_sale_row.ticket_number,
    'store_id', v_store_id,
    'processed_by', v_processed_by,
    'reason', v_reason,
    'reason_note', v_reason_note,
    'lines', v_lines_result,
    'refund_amount', v_total_refund,
    'status', 'completed',
    'created_at', now()
  );

  RETURN v_result;
END;
$fn_return$;

COMMENT ON FUNCTION process_return(JSONB) IS 'Atomic return processing: validates original sale, calculates proportional refund, re-stocks items, creates return + lines + movements + audit.';

-- ─── Function: execute_transfer ──────────────────────────────────────────────
-- Atomic stock transfer: deducts from source, increments destination,
-- validates stock, creates transfer + lines + movements + audit.
--
-- Input JSONB structure:
-- {
--   "source_store_id": "uuid",
--   "destination_store_id": "uuid",
--   "created_by": "uuid",
--   "note": "text" | null,
--   "lines": [{ "variant_id": "uuid", "quantity": int }]
-- }

CREATE OR REPLACE FUNCTION execute_transfer(transfer_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_xfer$
DECLARE
  v_source_store_id UUID := (transfer_data->>'source_store_id')::UUID;
  v_dest_store_id   UUID := (transfer_data->>'destination_store_id')::UUID;
  v_created_by      UUID := (transfer_data->>'created_by')::UUID;
  v_note            TEXT := transfer_data->>'note';

  v_transfer_id     UUID;
  v_transfer_number TEXT;

  v_line            JSONB;
  v_variant_id      UUID;
  v_quantity        INTEGER;
  v_source_stock    stock_levels%ROWTYPE;
  v_dest_stock      stock_levels%ROWTYPE;
  v_dest_stock_before INTEGER;

  -- Result
  v_result          JSONB;
  v_lines_result    JSONB := '[]'::JSONB;
BEGIN
  -- 1. Generate transfer number
  v_transfer_number := next_transfer_number();

  -- 2. Create transfer record
  INSERT INTO stock_transfers (
    id, transfer_number, source_store_id, destination_store_id,
    status, note, created_by, confirmed_at, created_at
  ) VALUES (
    gen_random_uuid(), v_transfer_number, v_source_store_id, v_dest_store_id,
    'confirmed', v_note, v_created_by, now(), now()
  ) RETURNING id INTO v_transfer_id;

  -- 3. Process each line
  FOR v_line IN SELECT * FROM jsonb_array_elements(transfer_data->'lines')
  LOOP
    v_variant_id := (v_line->>'variant_id')::UUID;
    v_quantity := (v_line->>'quantity')::INTEGER;

    -- Lock source stock row
    SELECT * INTO v_source_stock
    FROM stock_levels
    WHERE variant_id = v_variant_id
      AND store_id = v_source_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_NOT_FOUND:No se encontró registro de stock para variante % en tienda origen %',
        v_variant_id, v_source_store_id;
    END IF;

    -- Validate sufficient stock at source
    IF v_source_stock.quantity < v_quantity THEN
      RAISE EXCEPTION 'STOCK_INSUFFICIENT:Variante % tiene % disponibles en origen, se requieren %',
        v_variant_id, v_source_stock.quantity, v_quantity;
    END IF;

    -- Insert transfer line
    INSERT INTO transfer_lines (id, transfer_id, variant_id, quantity)
    VALUES (gen_random_uuid(), v_transfer_id, v_variant_id, v_quantity);

    -- Deduct from source
    UPDATE stock_levels
    SET quantity = quantity - v_quantity,
        updated_at = now()
    WHERE id = v_source_stock.id;

    -- Record source movement (transfer_out)
    INSERT INTO stock_movements (
      id, variant_id, store_id, movement_type, quantity,
      stock_before, stock_after, reference_type, reference_id,
      user_id, created_at
    ) VALUES (
      gen_random_uuid(), v_variant_id, v_source_store_id, 'transfer_out', -v_quantity,
      v_source_stock.quantity, v_source_stock.quantity - v_quantity,
      'transfer', v_transfer_id, v_created_by, now()
    );

    -- Increment destination (lock existing or create new)
    SELECT * INTO v_dest_stock
    FROM stock_levels
    WHERE variant_id = v_variant_id
      AND store_id = v_dest_store_id
    FOR UPDATE;

    IF FOUND THEN
      v_dest_stock_before := v_dest_stock.quantity;

      UPDATE stock_levels
      SET quantity = quantity + v_quantity,
          updated_at = now()
      WHERE id = v_dest_stock.id;
    ELSE
      v_dest_stock_before := 0;

      INSERT INTO stock_levels (id, variant_id, store_id, quantity, updated_at)
      VALUES (gen_random_uuid(), v_variant_id, v_dest_store_id, v_quantity, now());
    END IF;

    -- Record destination movement (transfer_in)
    INSERT INTO stock_movements (
      id, variant_id, store_id, movement_type, quantity,
      stock_before, stock_after, reference_type, reference_id,
      user_id, created_at
    ) VALUES (
      gen_random_uuid(), v_variant_id, v_dest_store_id, 'transfer_in', v_quantity,
      v_dest_stock_before, v_dest_stock_before + v_quantity,
      'transfer', v_transfer_id, v_created_by, now()
    );

    -- Check low stock threshold at source and create alert if needed
    IF (v_source_stock.quantity - v_quantity) <= v_source_stock.low_stock_threshold THEN
      INSERT INTO stock_alerts (
        id, variant_id, store_id, current_stock, threshold, status
      ) VALUES (
        gen_random_uuid(), v_variant_id, v_source_store_id,
        v_source_stock.quantity - v_quantity, v_source_stock.low_stock_threshold, 'active'
      )
      ON CONFLICT ON CONSTRAINT stock_alerts_pkey DO NOTHING;
    END IF;

    -- Build line result
    v_lines_result := v_lines_result || jsonb_build_object(
      'variant_id', v_variant_id,
      'quantity', v_quantity,
      'source_stock_before', v_source_stock.quantity,
      'source_stock_after', v_source_stock.quantity - v_quantity,
      'dest_stock_before', v_dest_stock_before,
      'dest_stock_after', v_dest_stock_before + v_quantity
    );
  END LOOP;

  -- 4. Audit log
  INSERT INTO audit_logs (
    id, user_id, action_type, entity_type, entity_id,
    store_id, new_values, created_at
  ) VALUES (
    gen_random_uuid(), v_created_by, 'transfer_executed', 'transfer', v_transfer_id::TEXT,
    v_source_store_id,
    jsonb_build_object(
      'transfer_number', v_transfer_number,
      'source_store_id', v_source_store_id,
      'destination_store_id', v_dest_store_id,
      'line_count', jsonb_array_length(transfer_data->'lines')
    ),
    now()
  );

  -- 5. Build result
  v_result := jsonb_build_object(
    'transfer_id', v_transfer_id,
    'transfer_number', v_transfer_number,
    'source_store_id', v_source_store_id,
    'destination_store_id', v_dest_store_id,
    'status', 'confirmed',
    'note', v_note,
    'created_by', v_created_by,
    'lines', v_lines_result,
    'confirmed_at', now(),
    'created_at', now()
  );

  RETURN v_result;
END;
$fn_xfer$;

COMMENT ON FUNCTION execute_transfer(JSONB) IS 'Atomic stock transfer: deducts from source, increments destination, validates stock, creates transfer + lines + movements + audit.';

-- ─── Function: adjust_stock ──────────────────────────────────────────────────
-- Atomic stock adjustment: updates stock level, records movement + adjustment + audit.
--
-- Input JSONB structure:
-- {
--   "variant_id": "uuid",
--   "store_id": "uuid",
--   "new_quantity": int,
--   "reason": "physical_count"|"damage"|"theft_loss"|"system_error"|"other",
--   "note": "text",
--   "adjusted_by": "uuid"
-- }

CREATE OR REPLACE FUNCTION adjust_stock(adjustment_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_adjust$
DECLARE
  v_variant_id     UUID := (adjustment_data->>'variant_id')::UUID;
  v_store_id       UUID := (adjustment_data->>'store_id')::UUID;
  v_new_quantity   INTEGER := (adjustment_data->>'new_quantity')::INTEGER;
  v_reason         adjustment_reason := (adjustment_data->>'reason')::adjustment_reason;
  v_note           TEXT := adjustment_data->>'note';
  v_adjusted_by    UUID := (adjustment_data->>'adjusted_by')::UUID;

  v_stock_row      stock_levels%ROWTYPE;
  v_old_quantity   INTEGER;
  v_adjustment_id  UUID;
  v_quantity_diff  INTEGER;

  v_result         JSONB;
BEGIN
  -- 1. Lock stock row
  SELECT * INTO v_stock_row
  FROM stock_levels
  WHERE variant_id = v_variant_id
    AND store_id = v_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Create stock_levels row if it doesn't exist
    INSERT INTO stock_levels (id, variant_id, store_id, quantity, updated_at)
    VALUES (gen_random_uuid(), v_variant_id, v_store_id, 0, now())
    RETURNING * INTO v_stock_row;
  END IF;

  v_old_quantity := v_stock_row.quantity;
  v_quantity_diff := v_new_quantity - v_old_quantity;

  -- 2. Create stock adjustment record
  INSERT INTO stock_adjustments (
    id, variant_id, store_id, quantity_before, quantity_after,
    reason, note, adjusted_by, created_at
  ) VALUES (
    gen_random_uuid(), v_variant_id, v_store_id, v_old_quantity, v_new_quantity,
    v_reason, v_note, v_adjusted_by, now()
  ) RETURNING id INTO v_adjustment_id;

  -- 3. Update stock level
  UPDATE stock_levels
  SET quantity = v_new_quantity,
      updated_at = now()
  WHERE id = v_stock_row.id;

  -- 4. Record stock movement
  INSERT INTO stock_movements (
    id, variant_id, store_id, movement_type, quantity,
    stock_before, stock_after, reference_type, reference_id,
    note, user_id, created_at
  ) VALUES (
    gen_random_uuid(), v_variant_id, v_store_id, 'adjustment', v_quantity_diff,
    v_old_quantity, v_new_quantity, 'adjustment', v_adjustment_id,
    v_note, v_adjusted_by, now()
  );

  -- 5. Check low stock threshold and create alert if needed
  IF v_new_quantity <= v_stock_row.low_stock_threshold THEN
    INSERT INTO stock_alerts (
      id, variant_id, store_id, current_stock, threshold, status
    ) VALUES (
      gen_random_uuid(), v_variant_id, v_store_id,
      v_new_quantity, v_stock_row.low_stock_threshold, 'active'
    )
    ON CONFLICT ON CONSTRAINT stock_alerts_pkey DO NOTHING;
  END IF;

  -- 6. Audit log
  INSERT INTO audit_logs (
    id, user_id, action_type, entity_type, entity_id,
    store_id, old_values, new_values, created_at
  ) VALUES (
    gen_random_uuid(), v_adjusted_by, 'stock_adjusted', 'stock_adjustment', v_adjustment_id::TEXT,
    v_store_id,
    jsonb_build_object('quantity', v_old_quantity),
    jsonb_build_object(
      'quantity', v_new_quantity,
      'reason', v_reason,
      'note', v_note
    ),
    now()
  );

  -- 7. Build result
  v_result := jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'variant_id', v_variant_id,
    'store_id', v_store_id,
    'quantity_before', v_old_quantity,
    'quantity_after', v_new_quantity,
    'quantity_diff', v_quantity_diff,
    'reason', v_reason,
    'note', v_note,
    'adjusted_by', v_adjusted_by,
    'created_at', now()
  );

  RETURN v_result;
END;
$fn_adjust$;

COMMENT ON FUNCTION adjust_stock(JSONB) IS 'Atomic stock adjustment: updates stock level, records movement + adjustment record + audit log.';
