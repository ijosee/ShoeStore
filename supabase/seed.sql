-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed Data: ShoeStore POS & Inventario
-- ═══════════════════════════════════════════════════════════════════════════════
-- 2 tiendas en Sevilla (Montellano y Morón de la Frontera)
-- 19 tallas, 8 colores, 6 categorías, 6 marcas, 4 métodos de pago
-- 10 productos con variantes y stock
-- Moneda: EUR (€)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Stores ──────────────────────────────────────────────────────────────────

INSERT INTO stores (id, name, code, address, phone, tax_id, return_policy_text, is_active) VALUES
(
  'a1b2c3d4-1111-4111-a111-000000000001',
  'Montellano',
  'MON',
  'C/ Real 45, 41770 Montellano, Sevilla',
  '+34 955 875 123',
  'B41123456',
  'Política de devolución: Dispone de 30 días naturales para realizar devoluciones presentando su ticket de compra original. El producto debe estar en condiciones originales, sin uso y con etiquetas.',
  true
),
(
  'a1b2c3d4-1111-4111-a111-000000000002',
  'Morón de la Frontera',
  'MOR',
  'Av. de la Constitución 12, 41530 Morón de la Frontera, Sevilla',
  '+34 955 851 234',
  'B41123456',
  'Política de devolución: Dispone de 30 días naturales para realizar devoluciones presentando su ticket de compra original. El producto debe estar en condiciones originales, sin uso y con etiquetas.',
  true
);

-- ─── Sizes (35–46) ───────────────────────────────────────────────────────────

INSERT INTO sizes (id, value, sort_order) VALUES
('b1b2c3d4-1111-4111-a111-000000000001', '35',   1),
('b1b2c3d4-1111-4111-a111-000000000002', '36',   2),
('b1b2c3d4-1111-4111-a111-000000000003', '37',   3),
('b1b2c3d4-1111-4111-a111-000000000004', '38',   4),
('b1b2c3d4-1111-4111-a111-000000000005', '39',   5),
('b1b2c3d4-1111-4111-a111-000000000006', '40',   6),
('b1b2c3d4-1111-4111-a111-000000000007', '41',   7),
('b1b2c3d4-1111-4111-a111-000000000008', '42',   8),
('b1b2c3d4-1111-4111-a111-000000000009', '43',   9),
('b1b2c3d4-1111-4111-a111-000000000010', '44',  10),
('b1b2c3d4-1111-4111-a111-000000000011', '45',  11),
('b1b2c3d4-1111-4111-a111-000000000012', '46',  12);

-- ─── Colors ──────────────────────────────────────────────────────────────────

INSERT INTO colors (id, name, hex_code, sort_order) VALUES
('c1b2c3d4-1111-4111-a111-000000000001', 'Negro',  '#000000', 1),
('c1b2c3d4-1111-4111-a111-000000000002', 'Marrón', '#8B4513', 2),
('c1b2c3d4-1111-4111-a111-000000000003', 'Blanco', '#FFFFFF', 3),
('c1b2c3d4-1111-4111-a111-000000000004', 'Rojo',   '#FF0000', 4),
('c1b2c3d4-1111-4111-a111-000000000005', 'Azul',   '#0000FF', 5),
('c1b2c3d4-1111-4111-a111-000000000006', 'Gris',   '#808080', 6),
('c1b2c3d4-1111-4111-a111-000000000007', 'Beige',  '#F5F5DC', 7),
('c1b2c3d4-1111-4111-a111-000000000008', 'Verde',  '#008000', 8);

-- ─── Categories ──────────────────────────────────────────────────────────────

INSERT INTO categories (id, name, description, is_active) VALUES
('d1b2c3d4-1111-4111-a111-000000000001', 'Formal',    'Calzado formal para oficina y eventos. Zapatos de vestir, mocasines y oxfords.',    true),
('d1b2c3d4-1111-4111-a111-000000000002', 'Deportivo', 'Calzado deportivo. Zapatillas de running, training y fútbol.',                      true),
('d1b2c3d4-1111-4111-a111-000000000003', 'Casual',    'Calzado casual para uso diario. Sneakers, loafers y zapatos de descanso.',          true),
('d1b2c3d4-1111-4111-a111-000000000004', 'Sandalia',  'Sandalias para verano. Sandalias de playa, de vestir y chanclas.',                  true),
('d1b2c3d4-1111-4111-a111-000000000005', 'Bota',      'Botas para diversas ocasiones. Botines, botas de agua y botas de montaña.',         true),
('d1b2c3d4-1111-4111-a111-000000000006', 'Infantil',  'Calzado para niños y niñas. Zapatillas escolares, sandalias y deportivas.',         true);

-- ─── Brands ──────────────────────────────────────────────────────────────────

INSERT INTO brands (id, name, is_active) VALUES
('e1b2c3d4-1111-4111-a111-000000000001', 'Nike',       true),
('e1b2c3d4-1111-4111-a111-000000000002', 'Adidas',     true),
('e1b2c3d4-1111-4111-a111-000000000003', 'Clarks',     true),
('e1b2c3d4-1111-4111-a111-000000000004', 'Geox',       true),
('e1b2c3d4-1111-4111-a111-000000000005', 'Skechers',   true),
('e1b2c3d4-1111-4111-a111-000000000006', 'Pablosky',   true);

-- ─── Payment Methods ─────────────────────────────────────────────────────────

INSERT INTO payment_methods (id, name, icon, is_active, sort_order) VALUES
('f1b2c3d4-1111-4111-a111-000000000001', 'Efectivo',           'banknote',    true, 1),
('f1b2c3d4-1111-4111-a111-000000000002', 'Tarjeta de Crédito', 'credit-card', true, 2),
('f1b2c3d4-1111-4111-a111-000000000003', 'Tarjeta de Débito',  'credit-card', true, 3),
('f1b2c3d4-1111-4111-a111-000000000004', 'Bizum',              'smartphone',  true, 4);

-- ─── Ticket Sequences ────────────────────────────────────────────────────────

INSERT INTO ticket_sequences (id, store_id, year, last_sequence) VALUES
('11b2c3d4-1111-4111-a111-000000000001', 'a1b2c3d4-1111-4111-a111-000000000001', 2026, 0),
('11b2c3d4-1111-4111-a111-000000000002', 'a1b2c3d4-1111-4111-a111-000000000002', 2026, 0);

INSERT INTO transfer_sequences (id, year, last_sequence) VALUES
('21b2c3d4-1111-4111-a111-000000000001', 2026, 0);

-- ─── Users (Jose = Admin, Rocio = Vendedora) ─────────────────────────────────
-- ─── Users placeholder (auth created via scripts/create-users.js) ─────────────
-- We insert into public.users with a fixed UUID. The auth user will be created
-- via the Supabase Admin API with the same UUID after db reset.
-- This avoids the password hashing issue with direct SQL inserts.

-- First create a dummy auth.users entry so the FK constraint is satisfied
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
VALUES
  ('a1a1a1a1-1111-4111-a111-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jose@shoestore.com', '$placeholder$', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('a1a1a1a1-1111-4111-a111-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rocio@shoestore.com', '$placeholder$', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, false);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'a1a1a1a1-1111-4111-a111-000000000001', 'a1a1a1a1-1111-4111-a111-000000000001', '{"sub":"a1a1a1a1-1111-4111-a111-000000000001","email":"jose@shoestore.com"}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'a1a1a1a1-1111-4111-a111-000000000002', 'a1a1a1a1-1111-4111-a111-000000000002', '{"sub":"a1a1a1a1-1111-4111-a111-000000000002","email":"rocio@shoestore.com"}', 'email', now(), now(), now());

INSERT INTO public.users (id, email, full_name, role, is_active) VALUES
  ('a1a1a1a1-1111-4111-a111-000000000001', 'jose@shoestore.com', 'Jose', 'admin', true),
  ('a1a1a1a1-1111-4111-a111-000000000002', 'rocio@shoestore.com', 'Rocio', 'seller', true);

INSERT INTO public.user_stores (user_id, store_id) VALUES
  ('a1a1a1a1-1111-4111-a111-000000000001', 'a1b2c3d4-1111-4111-a111-000000000001'),
  ('a1a1a1a1-1111-4111-a111-000000000001', 'a1b2c3d4-1111-4111-a111-000000000002'),
  ('a1a1a1a1-1111-4111-a111-000000000002', 'a1b2c3d4-1111-4111-a111-000000000001'),
  ('a1a1a1a1-1111-4111-a111-000000000002', 'a1b2c3d4-1111-4111-a111-000000000002');

-- ─── Products (10 productos con variantes y stock) ───────────────────────────

-- 1. Nike Air Max (Deportivo)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000001', 'Nike Air Max 90', 'e1b2c3d4-1111-4111-a111-000000000001', 'd1b2c3d4-1111-4111-a111-000000000002', 'Zapatilla deportiva icónica con cámara de aire visible.', 149.95, 75.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000001', 'a2b2c3d4-1111-4111-a111-000000000001', 'b1b2c3d4-1111-4111-a111-000000000006', 'c1b2c3d4-1111-4111-a111-000000000001', 'DEP-NIK-40-NEG', true),
       ('b2b2c3d4-1111-4111-a111-000000000002', 'a2b2c3d4-1111-4111-a111-000000000001', 'b1b2c3d4-1111-4111-a111-000000000007', 'c1b2c3d4-1111-4111-a111-000000000003', 'DEP-NIK-41-BLA', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000001', 'a1b2c3d4-1111-4111-a111-000000000001', 8, 3),
('b2b2c3d4-1111-4111-a111-000000000001', 'a1b2c3d4-1111-4111-a111-000000000002', 5, 3),
('b2b2c3d4-1111-4111-a111-000000000002', 'a1b2c3d4-1111-4111-a111-000000000001', 6, 3);

-- 2. Adidas Ultraboost (Deportivo)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000002', 'Adidas Ultraboost 22', 'e1b2c3d4-1111-4111-a111-000000000002', 'd1b2c3d4-1111-4111-a111-000000000002', 'Zapatilla de running con tecnología Boost.', 179.95, 90.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000003', 'a2b2c3d4-1111-4111-a111-000000000002', 'b1b2c3d4-1111-4111-a111-000000000008', 'c1b2c3d4-1111-4111-a111-000000000001', 'DEP-ADI-42-NEG', true),
       ('b2b2c3d4-1111-4111-a111-000000000004', 'a2b2c3d4-1111-4111-a111-000000000002', 'b1b2c3d4-1111-4111-a111-000000000006', 'c1b2c3d4-1111-4111-a111-000000000005', 'DEP-ADI-40-AZU', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000003', 'a1b2c3d4-1111-4111-a111-000000000001', 4, 2),
('b2b2c3d4-1111-4111-a111-000000000004', 'a1b2c3d4-1111-4111-a111-000000000002', 7, 3);

-- 3. Clarks Oxford (Formal)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000003', 'Clarks Oxford Premium', 'e1b2c3d4-1111-4111-a111-000000000003', 'd1b2c3d4-1111-4111-a111-000000000001', 'Zapato Oxford de piel genuina para ocasiones formales.', 129.95, 65.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000005', 'a2b2c3d4-1111-4111-a111-000000000003', 'b1b2c3d4-1111-4111-a111-000000000007', 'c1b2c3d4-1111-4111-a111-000000000001', 'FOR-CLA-41-NEG', true),
       ('b2b2c3d4-1111-4111-a111-000000000006', 'a2b2c3d4-1111-4111-a111-000000000003', 'b1b2c3d4-1111-4111-a111-000000000008', 'c1b2c3d4-1111-4111-a111-000000000002', 'FOR-CLA-42-MAR', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000005', 'a1b2c3d4-1111-4111-a111-000000000001', 5, 2),
('b2b2c3d4-1111-4111-a111-000000000006', 'a1b2c3d4-1111-4111-a111-000000000001', 3, 2),
('b2b2c3d4-1111-4111-a111-000000000006', 'a1b2c3d4-1111-4111-a111-000000000002', 4, 2);

-- 4. Geox Nebula (Casual)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000004', 'Geox Nebula', 'e1b2c3d4-1111-4111-a111-000000000004', 'd1b2c3d4-1111-4111-a111-000000000003', 'Zapato casual transpirable con tecnología Geox.', 109.95, 55.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000007', 'a2b2c3d4-1111-4111-a111-000000000004', 'b1b2c3d4-1111-4111-a111-000000000006', 'c1b2c3d4-1111-4111-a111-000000000006', 'CAS-GEO-40-GRI', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000007', 'a1b2c3d4-1111-4111-a111-000000000001', 10, 3),
('b2b2c3d4-1111-4111-a111-000000000007', 'a1b2c3d4-1111-4111-a111-000000000002', 6, 3);

-- 5. Skechers Go Walk (Casual)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000005', 'Skechers Go Walk 6', 'e1b2c3d4-1111-4111-a111-000000000005', 'd1b2c3d4-1111-4111-a111-000000000003', 'Zapatilla ultraligera para caminar con plantilla Goga Mat.', 79.95, 40.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000008', 'a2b2c3d4-1111-4111-a111-000000000005', 'b1b2c3d4-1111-4111-a111-000000000005', 'c1b2c3d4-1111-4111-a111-000000000001', 'CAS-SKE-39-NEG', true),
       ('b2b2c3d4-1111-4111-a111-000000000009', 'a2b2c3d4-1111-4111-a111-000000000005', 'b1b2c3d4-1111-4111-a111-000000000004', 'c1b2c3d4-1111-4111-a111-000000000007', 'CAS-SKE-38-BEI', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000008', 'a1b2c3d4-1111-4111-a111-000000000001', 12, 4),
('b2b2c3d4-1111-4111-a111-000000000009', 'a1b2c3d4-1111-4111-a111-000000000002', 8, 3);

-- 6. Nike Sandalia Verano (Sandalia)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000006', 'Nike Sunray Adjust', 'e1b2c3d4-1111-4111-a111-000000000001', 'd1b2c3d4-1111-4111-a111-000000000004', 'Sandalia deportiva con cierre de velcro.', 39.95, 20.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000010', 'a2b2c3d4-1111-4111-a111-000000000006', 'b1b2c3d4-1111-4111-a111-000000000003', 'c1b2c3d4-1111-4111-a111-000000000005', 'SAN-NIK-37-AZU', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000010', 'a1b2c3d4-1111-4111-a111-000000000001', 15, 5),
('b2b2c3d4-1111-4111-a111-000000000010', 'a1b2c3d4-1111-4111-a111-000000000002', 10, 5);

-- 7. Clarks Desert Boot (Bota)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000007', 'Clarks Desert Boot', 'e1b2c3d4-1111-4111-a111-000000000003', 'd1b2c3d4-1111-4111-a111-000000000005', 'Botín clásico de ante con suela de crepé.', 139.95, 70.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000011', 'a2b2c3d4-1111-4111-a111-000000000007', 'b1b2c3d4-1111-4111-a111-000000000008', 'c1b2c3d4-1111-4111-a111-000000000002', 'BOT-CLA-42-MAR', true),
       ('b2b2c3d4-1111-4111-a111-000000000012', 'a2b2c3d4-1111-4111-a111-000000000007', 'b1b2c3d4-1111-4111-a111-000000000009', 'c1b2c3d4-1111-4111-a111-000000000001', 'BOT-CLA-43-NEG', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000011', 'a1b2c3d4-1111-4111-a111-000000000001', 3, 2),
('b2b2c3d4-1111-4111-a111-000000000012', 'a1b2c3d4-1111-4111-a111-000000000002', 5, 2);

-- 8. Pablosky Colegial (Infantil)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000008', 'Pablosky Colegial', 'e1b2c3d4-1111-4111-a111-000000000006', 'd1b2c3d4-1111-4111-a111-000000000006', 'Zapato escolar de piel con puntera reforzada.', 54.95, 28.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000013', 'a2b2c3d4-1111-4111-a111-000000000008', 'b1b2c3d4-1111-4111-a111-000000000001', 'c1b2c3d4-1111-4111-a111-000000000001', 'INF-PAB-35-NEG', true),
       ('b2b2c3d4-1111-4111-a111-000000000014', 'a2b2c3d4-1111-4111-a111-000000000008', 'b1b2c3d4-1111-4111-a111-000000000002', 'c1b2c3d4-1111-4111-a111-000000000002', 'INF-PAB-36-MAR', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000013', 'a1b2c3d4-1111-4111-a111-000000000001', 20, 5),
('b2b2c3d4-1111-4111-a111-000000000014', 'a1b2c3d4-1111-4111-a111-000000000001', 15, 5),
('b2b2c3d4-1111-4111-a111-000000000013', 'a1b2c3d4-1111-4111-a111-000000000002', 18, 5);

-- 9. Adidas Stan Smith (Casual)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000009', 'Adidas Stan Smith', 'e1b2c3d4-1111-4111-a111-000000000002', 'd1b2c3d4-1111-4111-a111-000000000003', 'Zapatilla clásica de piel con suela de goma.', 99.95, 50.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000015', 'a2b2c3d4-1111-4111-a111-000000000009', 'b1b2c3d4-1111-4111-a111-000000000006', 'c1b2c3d4-1111-4111-a111-000000000003', 'CAS-ADI-40-BLA', true),
       ('b2b2c3d4-1111-4111-a111-000000000016', 'a2b2c3d4-1111-4111-a111-000000000009', 'b1b2c3d4-1111-4111-a111-000000000007', 'c1b2c3d4-1111-4111-a111-000000000008', 'CAS-ADI-41-VER', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000015', 'a1b2c3d4-1111-4111-a111-000000000001', 9, 3),
('b2b2c3d4-1111-4111-a111-000000000016', 'a1b2c3d4-1111-4111-a111-000000000002', 7, 3);

-- 10. Geox Mocasín (Formal)
INSERT INTO products (id, name, brand_id, category_id, description, base_price, cost, tax_rate, is_active, created_by)
VALUES ('a2b2c3d4-1111-4111-a111-000000000010', 'Geox Mocasín Symbol', 'e1b2c3d4-1111-4111-a111-000000000004', 'd1b2c3d4-1111-4111-a111-000000000001', 'Mocasín de piel transpirable para uso diario y formal.', 119.95, 60.00, 0.21, true, 'a1a1a1a1-1111-4111-a111-000000000001');

INSERT INTO product_variants (id, product_id, size_id, color_id, sku, is_active)
VALUES ('b2b2c3d4-1111-4111-a111-000000000017', 'a2b2c3d4-1111-4111-a111-000000000010', 'b1b2c3d4-1111-4111-a111-000000000009', 'c1b2c3d4-1111-4111-a111-000000000001', 'FOR-GEO-43-NEG', true);

INSERT INTO stock_levels (variant_id, store_id, quantity, low_stock_threshold) VALUES
('b2b2c3d4-1111-4111-a111-000000000017', 'a1b2c3d4-1111-4111-a111-000000000001', 6, 2),
('b2b2c3d4-1111-4111-a111-000000000017', 'a1b2c3d4-1111-4111-a111-000000000002', 4, 2);
