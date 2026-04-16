# Plan de Implementación: ShoeStore POS & Inventario

## Resumen

Plan de implementación incremental para el sistema ShoeStore POS & Inventario. Stack: Next.js (App Router) + Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime), Shadcn/ui + Tailwind CSS, Zustand + TanStack Query, Vitest + fast-check + Playwright. Cada tarea construye sobre las anteriores, integrando tests de propiedades junto a la funcionalidad que validan.

## Tareas

- [x] 1. Configuración del proyecto y estructura base
  - [x] 1.1 Inicializar proyecto Next.js con TypeScript, Tailwind CSS y Shadcn/ui
    - Crear proyecto Next.js 14+ con App Router y TypeScript estricto
    - Instalar y configurar Tailwind CSS con el theme de la aplicación (colores de marca, fuentes)
    - Inicializar Shadcn/ui y agregar componentes base: Button, Input, Card, Dialog, Table, Select, Badge, Toast, DropdownMenu, Sheet, Tabs, Checkbox, Label, Textarea, Switch
    - Configurar `next.config.js` con headers de seguridad HTTP (CSP, X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy)
    - Crear archivo `.env.local` con variables de entorno para Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
    - _Requisitos: NF-3.5, NF-4.4_

  - [x] 1.2 Configurar Supabase CLI y proyecto local
    - Instalar Supabase CLI e inicializar proyecto (`supabase init`)
    - Configurar `supabase/config.toml` con settings del proyecto
    - Crear clientes de Supabase: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (API routes), `lib/supabase/middleware.ts` (auth middleware)
    - _Requisitos: NF-1, NF-3_

  - [x] 1.3 Configurar framework de testing (Vitest + fast-check + Playwright)
    - Instalar y configurar Vitest como test runner principal
    - Instalar fast-check para property-based testing
    - Instalar @testing-library/react para tests de componentes
    - Instalar Playwright para tests E2E
    - Crear estructura de directorios: `tests/unit/`, `tests/property/`, `tests/integration/`, `tests/e2e/`
    - Agregar scripts en `package.json`: `test:unit`, `test:property`, `test:integration`, `test:e2e`, `test`, `test:coverage`
    - _Requisitos: NF-1_

  - [x] 1.4 Crear estructura de carpetas del proyecto
    - Crear la estructura de directorios según el diseño (sección 4.1): `src/app/`, `src/components/`, `src/lib/`, `src/hooks/`, `src/stores/`, `src/types/`
    - Crear archivos de constantes (`lib/constants.ts`) y tipos base (`types/database.ts`, `types/cart.ts`, `types/printing.ts`, `types/permissions.ts`)
    - _Requisitos: 1, 2, 3, 6_

  - [x] 1.5 Configurar Zod y crear schemas de validación base
    - Instalar Zod
    - Crear schemas de validación en `lib/validators/`: `product.ts`, `sale.ts`, `inventory.ts`, `auth.ts`
    - Incluir validaciones de campos requeridos, límites de caracteres, formatos de moneda, rangos numéricos
    - _Requisitos: 1.1, 1.2, 6.7, 11.2, NF-3.4_

- [x] 2. Esquema de base de datos y migraciones
  - [x] 2.1 Crear migraciones para tablas de configuración (stores, sizes, colors, categories, brands, payment_methods)
    - Escribir migración `001_create_stores.sql`: tabla `stores` con campos id, name, code, address, phone, tax_id, logo_url, return_policy_text, is_active, created_at, updated_at; índices UNIQUE(code), INDEX(is_active)
    - Escribir migración `002_create_catalog_config.sql`: tablas `sizes` (id, value, sort_order), `colors` (id, name, hex_code, sort_order), `categories` (id, name, description, is_active), `brands` (id, name, is_active); con índices UNIQUE correspondientes
    - Escribir migración `003_create_payment_methods.sql`: tabla `payment_methods` con campos id, name, icon, is_active, sort_order, created_at
    - _Requisitos: 1.1, 2.1, 7.1, 7.4_

  - [x] 2.2 Crear migraciones para tablas de usuarios y autenticación
    - Escribir migración `004_create_users.sql`: tabla `users` con campos id, email, password_hash, full_name, role (ENUM: admin, manager, seller), is_active, failed_login_attempts, locked_until, last_login_at, created_at, updated_at; índices UNIQUE(email), INDEX(role), INDEX(is_active)
    - Escribir tabla `user_stores` con campos id, user_id (FK), store_id (FK), created_at; índice UNIQUE(user_id, store_id)
    - _Requisitos: 11.1, 11.5, 11.6_

  - [x] 2.3 Crear migraciones para tablas de catálogo (products, product_images, product_variants)
    - Escribir migración `005_create_catalog.sql`: tabla `products` con todos los campos definidos en el modelo de datos (name, brand_id FK, category_id FK, description, base_price, cost, tax_rate, is_active, created_by FK, timestamps); CHECK constraints para precios >= 0
    - Tabla `product_images` con campos id, product_id FK, color, image_url, thumbnail_url, optimized_url, sort_order, is_primary, created_at
    - Tabla `product_variants` con campos id, product_id FK, size_id FK, color_id FK, sku UNIQUE, barcode UNIQUE NULLABLE, price_override NULLABLE, is_active, timestamps; índice UNIQUE(product_id, size_id, color_id)
    - Crear índice FULLTEXT sobre products.name para búsqueda POS
    - _Requisitos: 1.1, 1.3, 1.5, 1.6, 1.7, 2.2, 2.3_

  - [x] 2.4 Crear migraciones para tablas de inventario (stock_levels, stock_movements, stock_transfers, transfer_lines, stock_adjustments)
    - Escribir migración `006_create_inventory.sql`: tabla `stock_levels` con variant_id FK, store_id FK, quantity (CHECK >= 0), low_stock_threshold, updated_at; índice UNIQUE(variant_id, store_id)
    - Tabla `stock_movements` con todos los campos del modelo (variant_id, store_id, movement_type ENUM, quantity, stock_before, stock_after, reference_type, reference_id, note, user_id, created_at); índices compuestos
    - Tabla `stock_transfers` con transfer_number UNIQUE, source_store_id FK, destination_store_id FK, status ENUM, note, created_by FK, confirmed_at, created_at
    - Tabla `transfer_lines` con transfer_id FK, variant_id FK, quantity (CHECK > 0)
    - Tabla `stock_adjustments` con variant_id FK, store_id FK, quantity_before, quantity_after, reason ENUM, note NOT NULL, adjusted_by FK, created_at
    - _Requisitos: 3.1, 3.4, 3.6, 3.8, 4.1, 4.2, 4.4_

  - [x] 2.5 Crear migraciones para tablas de ventas y devoluciones
    - Escribir migración `007_create_sales.sql`: tabla `sales` con ticket_number UNIQUE, store_id FK, seller_id FK, subtotal, discount_amount, discount_type ENUM, discount_value, tax_amount, total, status ENUM, voided_by FK, voided_at, void_reason, created_at; índices en store_id, seller_id, created_at, status
    - Tabla `sale_lines` con sale_id FK, variant_id FK, product_name (snapshot), variant_description (snapshot), quantity (CHECK > 0), unit_price, line_discount, tax_rate, line_subtotal, line_tax, line_total
    - Tabla `sale_payments` con sale_id FK, payment_method_id FK, amount, amount_received, change_amount
    - Tabla `ticket_sequences` con store_id FK, year, last_sequence; índice UNIQUE(store_id, year)
    - _Requisitos: 6.5, 6.8, 6.9, 7.2, 7.3, 8.1, 8.2, 8.3_

  - [x] 2.6 Crear migraciones para tablas de devoluciones
    - Escribir migración `008_create_returns.sql`: tabla `returns` con return_number UNIQUE, original_sale_id FK, store_id FK, processed_by FK, approved_by FK NULLABLE, reason ENUM, reason_note, refund_amount, status ENUM, created_at
    - Tabla `return_lines` con return_id FK, sale_line_id FK, variant_id FK, quantity (CHECK > 0), refund_amount
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_

  - [x] 2.7 Crear migraciones para tablas de auditoría y alertas
    - Escribir migración `009_create_audit.sql`: tabla `audit_logs` con user_id FK NULLABLE, action_type, entity_type, entity_id, store_id FK NULLABLE, old_values JSONB, new_values JSONB, ip_address, user_agent, created_at; índices en user_id, action_type, entity_type+entity_id, store_id, created_at
    - Tabla `stock_alerts` con variant_id FK, store_id FK, current_stock, threshold, status ENUM (active, acknowledged), acknowledged_by FK, acknowledged_note, acknowledged_at, created_at; índice en store_id+status
    - _Requisitos: 12.1, 12.2, 12.3, 12.5, 13.1_

  - [x] 2.8 Crear funciones PL/pgSQL para operaciones atómicas
    - Implementar función `next_ticket_number(p_store_id UUID)` con INSERT ON CONFLICT para secuencia atómica, formato `{PREFIX}-{YEAR}-{SEQ_6_DIGITS}`
    - Implementar función `next_transfer_number()` con formato `TRF-{YEAR}-{SEQ_6_DIGITS}`
    - Implementar función `confirm_sale(sale_data JSONB)` con SELECT FOR UPDATE, validación de stock, creación de venta + líneas + pagos + movimientos + alertas + auditoría en una transacción
    - Implementar función `process_return(return_data JSONB)` con cálculo de reembolso proporcional, reingreso de stock, generación de número de devolución, auditoría
    - Implementar función `execute_transfer(transfer_data JSONB)` con deducción atómica en origen e incremento en destino, validación de stock, movimientos, auditoría
    - Implementar función `adjust_stock(adjustment_data JSONB)` con ajuste de stock, registro de movimiento, auditoría
    - _Requisitos: 3.2, 3.3, 4.2, 4.3, 6.9, 8.1, 8.2, 9.4_

  - [x] 2.9 Crear políticas de Row Level Security (RLS)
    - Escribir migración `011_create_rls_policies.sql`
    - Política para `stock_levels`: vendedores y gerentes solo ven stock de sus tiendas asignadas; admin ve todo
    - Política para `sales`: vendedores ven solo sus ventas; gerentes ven ventas de su tienda; admin ve todo
    - Política para `stock_movements`: filtrado por tienda asignada
    - Política para `stock_alerts`: filtrado por tienda asignada
    - Política para `audit_logs`: inmutable (bloquear UPDATE/DELETE), INSERT solo vía funciones SECURITY DEFINER; lectura filtrada por rol
    - Habilitar RLS en todas las tablas con datos sensibles
    - _Requisitos: 11.6, 12.5, NF-3.3_

  - [x] 2.10 Crear triggers de auditoría
    - Escribir migración `012_create_triggers.sql`
    - Implementar función genérica `audit_trigger_func()` con SECURITY DEFINER
    - Crear triggers AFTER INSERT/UPDATE/DELETE en tablas: products, stock_adjustments, stock_transfers, sales, returns, users
    - Trigger para verificar umbrales de stock bajo después de cambios en `stock_levels`
    - _Requisitos: 12.1, 12.2, 13.1_

  - [x] 2.11 Crear archivo de datos semilla (seed.sql)
    - Escribir `supabase/seed.sql` con datos iniciales: 3 tiendas (Centro TC, Norte TN, Sur TS), tallas estándar (22-31), colores básicos (8 colores), categorías (6), métodos de pago (4), secuencias de tickets iniciales
    - Crear script `scripts/setup.sh` para inicialización completa (supabase start, db reset, crear usuario admin)
    - _Requisitos: 2.1, 7.1, 8.4_

- [x] 3. Checkpoint — Verificar migraciones y esquema de base de datos
  - Ejecutar `supabase db reset` para aplicar todas las migraciones y seed data
  - Verificar que todas las tablas, índices, constraints, funciones, triggers y políticas RLS se crean correctamente
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Autenticación y autorización
  - [x] 4.1 Implementar flujo de autenticación con Supabase Auth
    - Crear página de login (`src/app/(auth)/login/page.tsx`) con formulario de email + contraseña, toggle de visibilidad, checkbox "Recordar sesión", estados de carga/error/bloqueo
    - Implementar `signInWithPassword()` con Supabase Auth en el formulario
    - Crear API route `src/app/api/auth/callback/route.ts` para manejar el callback de autenticación
    - Implementar lógica de bloqueo de cuenta: incrementar `failed_login_attempts` en login fallido, bloquear 15 minutos tras 5 intentos consecutivos
    - Crear Zustand store `src/stores/auth-store.ts` para gestionar sesión, perfil de usuario, rol y tiendas asignadas
    - Crear hook `src/hooks/useAuth.ts` para acceder al estado de autenticación
    - _Requisitos: 11.1, 11.3, 11.4_

  - [ ]* 4.2 Escribir test de propiedad para validación de contraseña
    - **Property 18: Validación de contraseña**
    - Implementar función `validatePassword(password: string): boolean` en `lib/validators/auth.ts`
    - Verificar que strings con ≥8 chars, ≥1 mayúscula, ≥1 minúscula, ≥1 número y ≥1 carácter especial son aceptados
    - Verificar que strings que no cumplen al menos un requisito son rechazados
    - **Validates: Requirements 11.2**

  - [x] 4.3 Implementar middleware de autorización RBAC
    - Crear middleware Next.js (`src/middleware.ts`) que valide sesión activa y redirija a /login si no autenticado
    - Implementar verificación de rol para rutas protegidas: `/usuarios` y `/config` solo Admin; `/inventario/ajustes` y `/auditoria` solo Gerente/Admin
    - Crear sistema de permisos en `lib/auth/permissions.ts` con mapa ROLE_PERMISSIONS y función `hasPermission(role, permission)`
    - Crear hook `src/hooks/usePermissions.ts` para verificar permisos en componentes
    - Crear hook `src/hooks/useStore.ts` para gestionar la tienda activa del usuario
    - _Requisitos: 11.6, 11.7, 2.2, 2.3_

  - [ ]* 4.4 Escribir tests unitarios para sistema de permisos
    - Verificar que cada rol tiene exactamente los permisos definidos en la matriz de permisos (sección 2.3 de requisitos)
    - Verificar que `hasPermission` retorna false para permisos no asignados
    - _Requisitos: 2.2, 2.3, 11.6_

- [x] 5. Funciones utilitarias y lógica de negocio core
  - [x] 5.1 Implementar funciones de generación de SKU y validación de códigos de barras
    - Crear `lib/utils/sku.ts` con función `generateSKU(category, brand, size, color)` que siga el patrón `{CAT_3}-{MARCA_3}-{TALLA}-{COLOR_3}`, removiendo acentos y convirtiendo a mayúsculas
    - Crear `lib/barcode/scanner.ts` con función `validateEAN13(barcode)` que valide formato de 13 dígitos y dígito de verificación según algoritmo EAN-13
    - Crear `lib/utils/currency.ts` con funciones de formateo de moneda MXN
    - _Requisitos: 1.6, 1.7_

  - [ ]* 5.2 Escribir test de propiedad para generación de SKU
    - **Property 1: Generación de SKU sigue el patrón y es determinista**
    - Para cualquier combinación válida de categoría, marca, talla y color, el SKU debe coincidir con el patrón `{CAT_3}-{MARCA_3}-{TALLA}-{COLOR_3}` y ser determinista
    - **Validates: Requirements 1.6**

  - [ ]* 5.3 Escribir test de propiedad para validación de EAN-13
    - **Property 2: Validación de código de barras EAN-13**
    - Para cualquier string de 13 dígitos con checksum correcto, la validación debe aceptarlo; con checksum incorrecto, debe rechazarlo
    - **Validates: Requirements 1.7**

  - [x] 5.4 Implementar cálculos de IVA, totales de venta y distribución de descuentos
    - Crear `lib/utils/tax.ts` con funciones: `calculateLineTotals(unitPrice, quantity, taxRate, lineDiscount)`, `calculateSaleTotals(lines, discount)`, `distributeDiscount(lines, discountAmount)` con ajuste de centavos en última línea
    - Implementar regla de redondeo ROUND_HALF_UP a 2 decimales
    - Crear `lib/utils/ticket-number.ts` con función de formateo de números de ticket
    - _Requisitos: 6.5, 6.7, 6.8_

  - [ ]* 5.5 Escribir test de propiedad para cálculos de totales de venta
    - **Property 5: Cálculo de totales de venta — subtotal, descuento, IVA y total**
    - Verificar invariantes: total = subtotal + tax, total >= 0, Σ line_discount = discount_amount (sin pérdida de centavos)
    - Usar generadores fast-check para carritos de 1-10 líneas con precios y tasas de IVA variables
    - **Validates: Requirements 6.5, 6.7, 6.8**

  - [ ]* 5.6 Escribir test de propiedad para validación de pagos
    - **Property 6: Validación de pagos — suma igual al total y cálculo de cambio**
    - Verificar que la suma de pagos = total de venta, y que para pagos en efectivo el cambio = amount_received - amount >= 0
    - **Validates: Requirements 7.2, 7.3**

  - [x] 5.7 Implementar cálculo de reembolso proporcional para devoluciones
    - Crear función `calculateRefund(saleLine, returnQuantity)` en `lib/utils/tax.ts` que calcule `ROUND(line_total × (returnQty / saleQty), 2)`
    - _Requisitos: 9.4_

  - [ ]* 5.8 Escribir test de propiedad para cálculo de reembolso proporcional
    - **Property 12: Cálculo de reembolso proporcional en devoluciones**
    - Para cualquier devolución de Q unidades de una línea con N unidades y line_total T, el reembolso debe ser ROUND(T × (Q/N), 2)
    - **Validates: Requirements 9.4**

- [x] 6. Checkpoint — Verificar lógica de negocio core
  - Ejecutar `npm run test:unit` y `npm run test:property` para verificar que todas las funciones utilitarias y sus tests pasan
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Layout principal y componentes compartidos
  - [x] 7.1 Crear layout del dashboard con sidebar y topbar
    - Implementar `src/app/(dashboard)/layout.tsx` con sidebar colapsable en móvil y topbar
    - Crear `src/components/layout/Sidebar.tsx` con menú de navegación según la estructura de información (sección 6.1 de requisitos): Dashboard, POS, Catálogo, Inventario, Ventas, Usuarios, Configuración, Auditoría; filtrado por rol del usuario
    - Crear `src/components/layout/TopBar.tsx` con logo, nombre de tienda activa, badge de alertas, menú de usuario
    - Crear `src/components/layout/StoreSelector.tsx` para cambiar tienda activa (Admin ve todas, Gerente/Vendedor solo las asignadas)
    - Crear `src/components/layout/AlertBadge.tsx` con conteo de alertas activas usando Supabase Realtime
    - _Requisitos: NF-4.1, NF-4.3, 13.2_

  - [x] 7.2 Crear componentes compartidos reutilizables
    - Implementar `src/components/shared/DataTable.tsx` con tabla responsiva, ordenamiento y filtros
    - Implementar `src/components/shared/Pagination.tsx` con paginación de 50 registros por página
    - Implementar `src/components/shared/ConfirmDialog.tsx` para confirmaciones de acciones destructivas
    - Implementar `src/components/shared/LoadingSpinner.tsx`
    - Crear `src/components/ErrorBoundary.tsx` como error boundary global con UI de fallback
    - _Requisitos: NF-4.1, NF-4.3_

  - [x] 7.3 Implementar página de Dashboard con widgets por rol
    - Crear `src/app/(dashboard)/page.tsx` con grid responsivo de tarjetas
    - Admin: ventas hoy (global), ventas por tienda, productos activos, alertas de stock, últimas 5 ventas, últimos 5 movimientos
    - Gerente: mismos widgets filtrados a su tienda
    - Vendedor: mis ventas hoy, acceso rápido POS, últimas 5 ventas propias
    - Usar TanStack Query para fetching y cache de datos del dashboard
    - _Requisitos: 13.1, 13.2_

- [x] 8. Módulo de catálogo
  - [x] 8.1 Implementar API routes del catálogo
    - Crear `src/app/api/products/route.ts` (GET lista con filtros/paginación, POST crear producto con variantes y stock inicial)
    - Crear `src/app/api/products/[id]/route.ts` (GET detalle, PUT editar)
    - Crear `src/app/api/products/[id]/status/route.ts` (PATCH activar/desactivar)
    - Crear `src/app/api/products/[id]/images/route.ts` (POST subir imagen a Supabase Storage)
    - Validar inputs con Zod schemas, verificar permisos (solo Admin para crear/editar)
    - Implementar generación automática de SKU al crear variantes
    - Validar SKU duplicado y retornar error 409 con detalle del producto existente
    - _Requisitos: 1.1, 1.2, 1.6, 1.8, 1.10_

  - [ ]* 8.2 Escribir test de propiedad para matriz de variantes
    - **Property 3: Matriz de variantes genera todas las combinaciones**
    - Para cualquier conjunto de N tallas y M colores, la generación debe producir exactamente N × M variantes únicas sin repeticiones
    - **Validates: Requirements 1.5, 2.2**

  - [ ]* 8.3 Escribir test de propiedad para resolución de precio de variante
    - **Property 4: Resolución de precio efectivo de variante**
    - Para cualquier variante, el precio efectivo debe ser price_override si no es null, o base_price del producto padre si es null; siempre positivo
    - **Validates: Requirements 2.3**

  - [x] 8.4 Implementar páginas de catálogo (lista, detalle, crear/editar producto)
    - Crear `src/app/(dashboard)/catalogo/productos/page.tsx` con tabla de productos, filtros (categoría, marca, estado, búsqueda), paginación
    - Crear `src/app/(dashboard)/catalogo/productos/[id]/page.tsx` con galería de fotos navegable, información del producto, tabla de variantes con stock por tienda (filtrado por permisos)
    - Crear `src/app/(dashboard)/catalogo/productos/nuevo/page.tsx` y `[id]/editar/page.tsx` con formulario multi-sección: info base, fotos (drag & drop, max 10, max 5MB, JPG/PNG/WebP), variantes (selector de tallas/colores + generación de matriz), stock inicial por tienda
    - Crear componentes: `ProductForm.tsx`, `VariantMatrix.tsx`, `ImageUploader.tsx`, `ProductGallery.tsx`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.9, 2.2, 2.3, 2.4, 2.5_

  - [x] 8.5 Implementar páginas de categorías y marcas
    - Crear `src/app/(dashboard)/catalogo/categorias/page.tsx` con CRUD de categorías
    - Crear `src/app/(dashboard)/catalogo/marcas/page.tsx` con CRUD de marcas
    - Solo accesible por Admin
    - _Requisitos: 1.1, 2.1_

- [x] 9. Módulo de inventario
  - [x] 9.1 Implementar API routes de inventario
    - Crear `src/app/api/inventory/stock/route.ts` (GET stock actual con filtros por tienda, categoría, marca, estado)
    - Crear `src/app/api/inventory/kardex/route.ts` (GET historial de movimientos con filtros por variante, tienda, tipo, rango de fechas, paginado en bloques de 50)
    - Crear `src/app/api/inventory/adjust/route.ts` (POST ajuste de stock, invoca función PL/pgSQL `adjust_stock`)
    - Crear `src/app/api/inventory/transfer/route.ts` (POST transferencia, invoca función PL/pgSQL `execute_transfer`)
    - Crear `src/app/api/inventory/alerts/route.ts` (GET alertas activas)
    - Crear `src/app/api/inventory/alerts/[id]/acknowledge/route.ts` (PATCH marcar alerta como atendida)
    - Validar permisos: ajustes y transferencias solo Gerente/Admin
    - _Requisitos: 3.1, 3.4, 3.5, 3.7, 3.8, 4.1, 4.2, 4.3, 13.1, 13.3_

  - [ ]* 9.2 Escribir test de propiedad para invariante de stock no negativo
    - **Property 7: Invariante de stock no negativo**
    - Para cualquier secuencia de operaciones de stock válidas, el nivel de stock resultante debe ser siempre >= 0
    - **Validates: Requirements 3.1**

  - [ ]* 9.3 Escribir test de propiedad para rechazo por stock insuficiente
    - **Property 9: Operaciones de stock rechazadas cuando stock insuficiente**
    - Para cualquier operación que intente reducir stock más allá de lo disponible, debe ser rechazada completamente sin cambios parciales
    - **Validates: Requirements 3.3, 4.3**

  - [ ]* 9.4 Escribir test de propiedad para conservación de stock en transferencias
    - **Property 10: Transferencia conserva el stock total**
    - Para cualquier transferencia de Q unidades de tienda A a tienda B, stock_A_after + stock_B_after = stock_A_before + stock_B_before
    - **Validates: Requirements 4.2**

  - [ ]* 9.5 Escribir test de propiedad para activación de alertas de stock bajo
    - **Property 13: Alerta de stock bajo se activa cuando stock <= umbral**
    - Para cualquier cambio de stock que resulte en nivel <= umbral, debe existir alerta activa; si nivel > umbral, no debe crearse nueva alerta
    - **Validates: Requirements 3.7, 13.1, 13.4**

  - [x] 9.6 Implementar páginas de inventario
    - Crear `src/app/(dashboard)/inventario/stock/page.tsx` con tabla de stock actual, filtros (tienda, categoría, marca, estado: normal/bajo/agotado, búsqueda), celdas con color según umbral (verde/amarillo/rojo), botón exportar CSV
    - Crear `src/app/(dashboard)/inventario/movimientos/page.tsx` con tabla de kardex, filtros (producto/variante, tienda, tipo de movimiento, rango de fechas), paginación de 50 registros
    - Crear `src/app/(dashboard)/inventario/ajustes/nuevo/page.tsx` con formulario: buscar variante, cantidad nueva, motivo (select de lista configurable), nota obligatoria
    - Crear `src/app/(dashboard)/inventario/transferencias/page.tsx` con lista de transferencias
    - Crear `src/app/(dashboard)/inventario/transferencias/nueva/page.tsx` con formulario: tienda origen, tienda destino, líneas (variante + cantidad), nota
    - Crear `src/app/(dashboard)/inventario/alertas/page.tsx` con lista de alertas activas, opción de marcar como atendida con nota
    - Crear componentes: `StockTable.tsx`, `KardexTable.tsx`, `AdjustmentForm.tsx`, `TransferForm.tsx`
    - Implementar suscripción Realtime para alertas de stock con hook `useStockAlerts.ts`
    - _Requisitos: 3.1, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.4, 13.1, 13.2, 13.3_

- [x] 10. Checkpoint — Verificar catálogo e inventario
  - Ejecutar todos los tests unitarios y de propiedades
  - Verificar que las operaciones de stock (ajuste, transferencia) funcionan correctamente con las funciones PL/pgSQL
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Módulo POS — Punto de Venta
  - [x] 11.1 Implementar API routes del POS
    - Crear `src/app/api/pos/search/route.ts` (GET búsqueda rápida con full-text search de PostgreSQL sobre nombre + SKU + barcode, filtrado por is_active=true y stock > 0 en tienda actual)
    - Crear `src/app/api/sales/confirm/route.ts` (POST confirmar venta, invoca función PL/pgSQL `confirm_sale` con validación de JWT + permisos)
    - Crear `src/app/api/sales/void/route.ts` (POST anular venta, solo Gerente/Admin)
    - Crear `src/app/api/sales/route.ts` (GET historial de ventas con filtros)
    - Crear `src/app/api/sales/[id]/route.ts` (GET detalle de venta)
    - Validar inputs con Zod: carrito no vacío, cantidades > 0, suma de pagos = total
    - _Requisitos: 6.1, 6.2, 6.9, 6.10, 6.11_

  - [ ]* 11.2 Escribir test de propiedad para deducción de stock en ventas
    - **Property 8: Venta deduce stock correctamente y crea movimiento**
    - Para cualquier venta confirmada con cantidad Q de variante V en tienda S, el stock debe disminuir en Q y debe existir StockMovement con movement_type='sale', quantity=-Q
    - **Validates: Requirements 3.2, 3.4**

  - [ ]* 11.3 Escribir test de propiedad para numeración de documentos
    - **Property 11: Numeración de documentos — formato y secuencialidad**
    - Para cualquier secuencia de N ventas en misma tienda/año, los tickets deben seguir formato `{PREFIX}-{YEAR}-{SEQ}` con SEQ de 6 dígitos, estrictamente secuenciales sin saltos
    - **Validates: Requirements 4.4, 8.1, 8.2**

  - [ ]* 11.4 Escribir test de propiedad para búsqueda POS
    - **Property 14: Búsqueda POS retorna solo productos activos con stock**
    - Para cualquier consulta, todos los resultados deben corresponder a variantes con is_active=true y stock > 0 en la tienda actual
    - **Validates: Requirements 1.8, 6.2**

  - [x] 11.5 Implementar Zustand store del carrito y hook useCart
    - Crear `src/stores/cart-store.ts` con estado: líneas del carrito, descuento (tipo + valor), método de pago, monto recibido
    - Acciones: addLine, removeLine, updateQuantity, applyDiscount, removeDiscount, setPayment, clearCart
    - Cálculos derivados: subtotal, discount_amount, tax_amount, total, change (para efectivo)
    - Crear hook `src/hooks/useCart.ts` como wrapper del store
    - _Requisitos: 6.5, 6.6, 6.7, 6.8_

  - [x] 11.6 Implementar interfaz del POS
    - Crear `src/app/(dashboard)/pos/page.tsx` con layout de dos columnas (60/40 en tablet/desktop, tabs en móvil)
    - Crear `src/components/pos/SearchBar.tsx` con búsqueda con debounce 300ms, icono de cámara para escaneo de código de barras
    - Crear `src/components/pos/ProductCard.tsx` con miniatura, nombre, precio, badge de stock
    - Crear `src/components/pos/Cart.tsx` con lista de líneas, resumen de totales, acciones
    - Crear `src/components/pos/CartLine.tsx` con controles +/-, precio, subtotal, botón eliminar
    - Crear `src/components/pos/DiscountModal.tsx` con opciones: porcentaje o monto fijo, a nivel de línea o carrito
    - Crear `src/components/pos/PaymentSelector.tsx` con botones toggle por método de pago, campo de monto recibido para efectivo con cálculo de cambio
    - Crear `src/components/pos/SaleConfirmation.tsx` con modal post-venta: número de ticket, opciones de reimpresión, botón "Nueva Venta"
    - Implementar estados: carrito vacío, procesando venta, venta exitosa, error de stock, error de impresión
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 7.1, 7.2, 7.3_

  - [x] 11.7 Implementar escaneo de código de barras
    - Crear `src/components/pos/BarcodeScanner.tsx` usando la cámara del dispositivo para escanear EAN-13 y UPC-A
    - Integrar con la búsqueda del POS para agregar producto automáticamente al carrito
    - _Requisitos: 6.3_

  - [x] 11.8 Implementar páginas de historial de ventas
    - Crear `src/app/(dashboard)/ventas/historial/page.tsx` con tabla de ventas, filtros (tienda, vendedor, rango de fechas, estado), paginación
    - Crear `src/app/(dashboard)/ventas/[id]/page.tsx` con detalle completo de venta: líneas, pagos, descuentos, opción de reimprimir ticket, opción de anular (solo Gerente/Admin)
    - _Requisitos: 6.9, 10.5_

- [x] 12. Módulo de devoluciones
  - [x] 12.1 Implementar API route de devoluciones
    - Crear `src/app/api/returns/process/route.ts` (POST procesar devolución, invoca función PL/pgSQL `process_return`)
    - Crear `src/app/api/returns/route.ts` (GET listar devoluciones con filtros)
    - Validar: venta original existe, artículos pertenecen a la venta, cantidad no excede lo vendido, motivo requerido, aprobación de gerente si venta > 30 días
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.6_

  - [x] 12.2 Implementar páginas de devoluciones
    - Crear `src/app/(dashboard)/ventas/devoluciones/page.tsx` con lista de devoluciones
    - Crear `src/app/(dashboard)/ventas/devoluciones/nueva/page.tsx` con flujo de 3 pasos: (1) buscar venta por número de ticket, (2) seleccionar artículos a devolver con cantidad, (3) motivo + nota + resumen de reembolso + confirmación
    - Calcular reembolso proporcional incluyendo descuentos e impuestos de la venta original
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 13. Subsistema de impresión
  - [x] 13.1 Implementar constructor de tickets ESC/POS
    - Instalar `@point-of-sale/receipt-printer-encoder` y `@point-of-sale/webbluetooth-receipt-printer`
    - Crear `src/lib/printing/escpos-builder.ts` con función `buildTicket(data: TicketData): Uint8Array` usando ReceiptPrinterEncoder
    - Implementar plantilla de ticket en `src/lib/printing/ticket-template.ts`: logo, nombre tienda, dirección, teléfono, RFC, fecha/hora, número de ticket, vendedor, líneas de detalle, descuentos, subtotal, IVA, total, método de pago, monto recibido/cambio, política de devolución
    - Soportar anchos de 58mm (32 chars) y 80mm (48 chars)
    - _Requisitos: 10.1, 10.2_

  - [x] 13.2 Implementar gestor de conexión Bluetooth
    - Crear `src/lib/printing/bluetooth-manager.ts` con clase `BluetoothPrinterManager`: connect(), print(data), disconnect(), isConnected()
    - Manejar errores de conexión con mensajes descriptivos en español
    - Crear Zustand store `src/stores/printer-store.ts` para estado de conexión de impresora
    - Crear hook `src/hooks/usePrinter.ts` para acceder al estado de impresora
    - _Requisitos: 10.3, 10.4_

  - [x] 13.3 Implementar fallback de generación de PDF
    - Instalar `jspdf`
    - Crear `src/lib/printing/pdf-fallback.ts` con función `generateTicketPDF(data: TicketData): Blob` que genera PDF con formato de ticket térmico (80mm ancho)
    - Implementar flujo de fallback: si Bluetooth no disponible, ofrecer opciones (reintentar, PDF, guardar para después)
    - _Requisitos: 10.4_

  - [x] 13.4 Implementar configuración de plantilla de ticket e impresoras
    - Crear `src/app/(dashboard)/config/ticket/page.tsx` para configurar: logo, textos de encabezado, texto de pie (política de devolución), secciones opcionales
    - Crear `src/app/(dashboard)/config/impresoras/page.tsx` para gestionar impresoras Bluetooth configuradas por tienda/dispositivo
    - _Requisitos: 10.5, 10.6_

  - [x] 13.5 Integrar impresión con flujo de venta y devolución
    - Conectar el flujo de confirmación de venta con el subsistema de impresión: enviar ticket automáticamente tras confirmar
    - Conectar el flujo de devolución con impresión de nota de devolución
    - Implementar reimpresión desde historial de ventas
    - _Requisitos: 10.3, 10.5, 9.5_

- [x] 14. Checkpoint — Verificar POS, devoluciones e impresión
  - Ejecutar todos los tests unitarios y de propiedades
  - Verificar flujo completo: buscar producto → agregar al carrito → aplicar descuento → confirmar venta → ticket generado → stock deducido
  - Verificar flujo de devolución: buscar venta → seleccionar items → confirmar → stock reingresado → nota generada
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Módulo de exportación CSV
  - [x] 15.1 Implementar API route y Edge Function de exportación CSV
    - Crear `src/app/api/export/csv/route.ts` que acepta tipo de exportación (stock_current, catalog, movements) y filtros
    - Generar CSV con codificación UTF-8 con BOM y separador de coma, fila de encabezados descriptivos
    - Limitar exportación a 50,000 registros por archivo; dividir en múltiples archivos si excede
    - Crear Edge Function `supabase/functions/export-csv/index.ts` para exportaciones pesadas
    - _Requisitos: 5.1, 5.2, 5.3_

  - [ ]* 15.2 Escribir test de propiedad para exportación CSV
    - **Property 19: Exportación CSV preserva datos**
    - Para cualquier conjunto de datos, exportar a CSV y parsear el resultado debe producir los mismos datos (round-trip); verificar UTF-8 BOM y separador de coma
    - **Validates: Requirements 5.1, 5.2**

- [x] 16. Módulo de auditoría
  - [x] 16.1 Implementar API route de auditoría
    - Crear `src/app/api/audit/route.ts` (GET consultar auditoría con filtros: rango de fechas, usuario, tipo de acción, tienda, entidad afectada; paginado)
    - Verificar permisos: solo Admin y Gerente (filtrado por tienda)
    - _Requisitos: 12.4_

  - [ ]* 16.2 Escribir test de propiedad para filtrado de auditoría
    - **Property 20: Filtrado de auditoría retorna solo registros coincidentes**
    - Para cualquier combinación de filtros, todos los registros retornados deben cumplir TODOS los filtros simultáneamente
    - **Validates: Requirements 12.4**

  - [ ]* 16.3 Escribir test de propiedad para creación de auditoría en acciones sensibles
    - **Property 17: Creación de auditoría para acciones sensibles**
    - Para cualquier acción sensible (crear/editar producto, ajustar stock, venta, devolución, transferencia, cambio de usuario), debe crearse registro en audit_logs con todos los campos requeridos
    - **Validates: Requirements 12.1, 12.2**

  - [x] 16.4 Implementar página de auditoría
    - Crear `src/app/(dashboard)/auditoria/page.tsx` con tabla de registros de auditoría, filtros (rango de fechas, usuario, tipo de acción, tienda, entidad), paginación
    - Mostrar detalle expandible con valores anteriores/nuevos en formato legible
    - Solo accesible por Admin y Gerente
    - _Requisitos: 12.4_

- [x] 17. Módulo de configuración
  - [x] 17.1 Implementar API routes de configuración
    - Crear `src/app/api/config/stores/route.ts` (GET listar, PUT editar tienda)
    - Crear `src/app/api/config/payment-methods/route.ts` (GET listar, POST crear, PUT editar método de pago)
    - Solo accesible por Admin
    - _Requisitos: 7.4, 8.4_

  - [x] 17.2 Implementar páginas de configuración
    - Crear `src/app/(dashboard)/config/tiendas/page.tsx` para editar datos de tiendas: nombre, código (prefijo de tickets), dirección, teléfono, RFC, logo, texto de política de devolución
    - Crear `src/app/(dashboard)/config/impuestos/page.tsx` para configurar tasas de IVA
    - Crear `src/app/(dashboard)/config/metodos-pago/page.tsx` para CRUD de métodos de pago (nombre, estado, icono)
    - Solo accesible por Admin
    - _Requisitos: 7.4, 8.4_

- [x] 18. Módulo de gestión de usuarios
  - [x] 18.1 Implementar API routes de usuarios
    - Crear `src/app/api/users/route.ts` (GET listar, POST crear usuario vía Supabase Admin API)
    - Crear `src/app/api/users/[id]/route.ts` (PUT editar)
    - Crear `src/app/api/users/[id]/status/route.ts` (PATCH activar/desactivar, invalidar sesiones activas al desactivar)
    - Validar: solo Admin puede gestionar usuarios; campos requeridos: nombre completo, email, rol, tienda(s) asignada(s)
    - _Requisitos: 11.5, 11.7_

  - [x] 18.2 Implementar página de gestión de usuarios
    - Crear `src/app/(dashboard)/usuarios/page.tsx` con tabla de usuarios, filtros (rol, tienda, estado), acciones (crear, editar, activar/desactivar)
    - Formulario de creación/edición: nombre completo, email, rol (select), tiendas asignadas (multi-select)
    - Crear `src/app/(dashboard)/perfil/page.tsx` para que cada usuario vea y edite su perfil
    - Solo accesible por Admin
    - _Requisitos: 11.5, 11.7_

- [x] 19. Checkpoint — Verificar módulos de soporte
  - Ejecutar todos los tests unitarios y de propiedades
  - Verificar exportación CSV, auditoría, configuración y gestión de usuarios
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Tests de integración para RLS y auditoría
  - [ ]* 20.1 Escribir test de propiedad para aislamiento de datos por tienda (RLS)
    - **Property 15: Aislamiento de datos por tienda (RLS)**
    - Para cualquier usuario seller/manager y cualquier tienda NO asignada, las consultas de stock, ventas, movimientos y alertas deben retornar cero registros de esa tienda
    - **Validates: Requirements 11.6**

  - [ ]* 20.2 Escribir test de propiedad para inmutabilidad de auditoría
    - **Property 16: Inmutabilidad de registros de auditoría**
    - Para cualquier registro existente en audit_logs, cualquier intento de UPDATE o DELETE debe ser rechazado por RLS, independientemente del rol
    - **Validates: Requirements 12.5**

- [x] 21. Configuración PWA
  - [x] 21.1 Configurar Progressive Web App
    - Crear `public/manifest.json` con nombre de la app, iconos, colores de tema, display standalone
    - Crear `public/sw.js` con Service Worker básico para cache de assets estáticos
    - Configurar Next.js para servir el manifest y registrar el Service Worker
    - Agregar meta tags PWA en el layout raíz
    - _Requisitos: NF-4.4_

- [x] 22. Pipeline CI/CD y configuración de despliegue
  - [x] 22.1 Configurar GitHub Actions para CI
    - Crear `.github/workflows/ci.yml` con jobs: lint, type-check, test:unit, test:property
    - Configurar deploy preview automático en Vercel para PRs
    - Configurar migración automática a Supabase staging en push a develop
    - Configurar migración automática a Supabase producción en push a main
    - _Requisitos: NF-2.1_

  - [x] 22.2 Configurar despliegue en Vercel y Supabase
    - Configurar proyecto en Vercel con variables de entorno para producción
    - Configurar proyecto Supabase de producción
    - Verificar que las migraciones se aplican correctamente en el entorno remoto
    - _Requisitos: NF-2.1, NF-2.3_

- [ ] 23. Tests E2E
  - [ ]* 23.1 Escribir tests E2E para flujos críticos
    - Test E2E de venta POS completa: login → buscar producto → agregar al carrito → aplicar descuento → seleccionar pago → confirmar → verificar ticket (`tests/e2e/pos-sale.spec.ts`)
    - Test E2E de creación de producto: login como Admin → crear producto con variantes → verificar en catálogo → verificar stock inicial (`tests/e2e/product-creation.spec.ts`)
    - Test E2E de devolución: login → buscar venta → seleccionar items → confirmar devolución → verificar stock reingresado (`tests/e2e/return-flow.spec.ts`)
    - Test E2E de autenticación: login exitoso, login fallido, bloqueo de cuenta (`tests/e2e/auth-flow.spec.ts`)
    - _Requisitos: 3.2, 6.9, 9.4, 11.1, 11.3_

- [x] 24. Checkpoint final — Verificación completa del sistema
  - Ejecutar suite completa de tests: `npm run test` (unit + property)
  - Verificar que todos los requisitos funcionales del MVP están cubiertos
  - Verificar que las 20 propiedades de correctitud tienen tests implementados
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental del progreso
- Los tests de propiedades validan las 20 propiedades de correctitud definidas en el diseño (sección 15)
- Los tests unitarios validan ejemplos específicos y casos borde
- El stack de testing es: Vitest + fast-check (property-based) + Playwright (E2E)
- Todos los ejemplos de código usan TypeScript como lenguaje de implementación