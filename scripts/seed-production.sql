-- Seed de producción: datos de catálogo (sin usuarios, ya creados via script)

-- Stores
INSERT INTO stores (id, name, code, address, phone, tax_id, return_policy_text, is_active) VALUES
('a1b2c3d4-1111-4111-a111-000000000001', 'Montellano', 'MON', 'C/ Real 45, 41770 Montellano, Sevilla', '+34 955 875 123', 'B41123456', 'Política de devolución: Dispone de 30 días naturales para realizar devoluciones presentando su ticket de compra original.', true),
('a1b2c3d4-1111-4111-a111-000000000002', 'Morón de la Frontera', 'MOR', 'Av. de la Constitución 12, 41530 Morón de la Frontera, Sevilla', '+34 955 851 234', 'B41123456', 'Política de devolución: Dispone de 30 días naturales para realizar devoluciones presentando su ticket de compra original.', true);

-- Sizes
INSERT INTO sizes (id, value, sort_order) VALUES
('b1b2c3d4-1111-4111-a111-000000000001','35',1),('b1b2c3d4-1111-4111-a111-000000000002','36',2),
('b1b2c3d4-1111-4111-a111-000000000003','37',3),('b1b2c3d4-1111-4111-a111-000000000004','38',4),
('b1b2c3d4-1111-4111-a111-000000000005','39',5),('b1b2c3d4-1111-4111-a111-000000000006','40',6),
('b1b2c3d4-1111-4111-a111-000000000007','41',7),('b1b2c3d4-1111-4111-a111-000000000008','42',8),
('b1b2c3d4-1111-4111-a111-000000000009','43',9),('b1b2c3d4-1111-4111-a111-000000000010','44',10),
('b1b2c3d4-1111-4111-a111-000000000011','45',11),('b1b2c3d4-1111-4111-a111-000000000012','46',12);

-- Colors
INSERT INTO colors (id, name, hex_code, sort_order) VALUES
('c1b2c3d4-1111-4111-a111-000000000001','Negro','#000000',1),('c1b2c3d4-1111-4111-a111-000000000002','Marrón','#8B4513',2),
('c1b2c3d4-1111-4111-a111-000000000003','Blanco','#FFFFFF',3),('c1b2c3d4-1111-4111-a111-000000000004','Rojo','#FF0000',4),
('c1b2c3d4-1111-4111-a111-000000000005','Azul','#0000FF',5),('c1b2c3d4-1111-4111-a111-000000000006','Gris','#808080',6),
('c1b2c3d4-1111-4111-a111-000000000007','Beige','#F5F5DC',7),('c1b2c3d4-1111-4111-a111-000000000008','Verde','#008000',8);

-- Categories
INSERT INTO categories (id, name, description, is_active) VALUES
('d1b2c3d4-1111-4111-a111-000000000001','Formal','Calzado formal para oficina y eventos.',true),
('d1b2c3d4-1111-4111-a111-000000000002','Deportivo','Calzado deportivo.',true),
('d1b2c3d4-1111-4111-a111-000000000003','Casual','Calzado casual para uso diario.',true),
('d1b2c3d4-1111-4111-a111-000000000004','Sandalia','Sandalias para verano.',true),
('d1b2c3d4-1111-4111-a111-000000000005','Bota','Botas para diversas ocasiones.',true),
('d1b2c3d4-1111-4111-a111-000000000006','Infantil','Calzado para niños y niñas.',true);

-- Brands
INSERT INTO brands (id, name, is_active) VALUES
('e1b2c3d4-1111-4111-a111-000000000001','Nike',true),('e1b2c3d4-1111-4111-a111-000000000002','Adidas',true),
('e1b2c3d4-1111-4111-a111-000000000003','Clarks',true),('e1b2c3d4-1111-4111-a111-000000000004','Geox',true),
('e1b2c3d4-1111-4111-a111-000000000005','Skechers',true),('e1b2c3d4-1111-4111-a111-000000000006','Pablosky',true);

-- Payment Methods
INSERT INTO payment_methods (id, name, icon, is_active, sort_order) VALUES
('f1b2c3d4-1111-4111-a111-000000000001','Efectivo','banknote',true,1),
('f1b2c3d4-1111-4111-a111-000000000002','Tarjeta de Crédito','credit-card',true,2),
('f1b2c3d4-1111-4111-a111-000000000003','Tarjeta de Débito','credit-card',true,3),
('f1b2c3d4-1111-4111-a111-000000000004','Bizum','smartphone',true,4);

-- Ticket Sequences
INSERT INTO ticket_sequences (id, store_id, year, last_sequence) VALUES
('11b2c3d4-1111-4111-a111-000000000001','a1b2c3d4-1111-4111-a111-000000000001',2026,0),
('11b2c3d4-1111-4111-a111-000000000002','a1b2c3d4-1111-4111-a111-000000000002',2026,0);

INSERT INTO transfer_sequences (id, year, last_sequence) VALUES
('21b2c3d4-1111-4111-a111-000000000001',2026,0);
