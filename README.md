# Zapatería Rocío — POS & Inventario

Sistema de punto de venta y gestión de inventario para una cadena de zapaterías con tiendas en **Montellano** y **Morón de la Frontera** (Sevilla).

## Stack Tecnológico

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **UI**: Shadcn/ui (Base Nova) + Tailwind CSS v4
- **Estado**: Zustand + TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Testing**: Vitest + fast-check + Playwright
- **Moneda**: Euro (€) · IVA: 21%

## Funcionalidades

### Punto de Venta (POS)
- Búsqueda rápida de productos por nombre, SKU o código de barras
- Carrito con descuentos (porcentaje o monto fijo)
- Múltiples métodos de pago (Efectivo, Tarjeta, Bizum)
- Generación de tickets con numeración secuencial por tienda
- Impresión térmica Bluetooth (ESC/POS) con fallback a PDF

### Catálogo de Productos
- Gestión de productos con variantes (talla/color)
- Generación automática de SKU
- Subida de fotos al crear/editar productos
- Categorías y marcas configurables

### Inventario
- Stock por tienda y variante
- Kardex (historial de movimientos)
- Ajustes de stock con motivo obligatorio
- Transferencias entre tiendas
- Alertas de stock bajo

### Ventas y Devoluciones
- Historial de ventas con filtros
- Anulación de ventas (admin/gerente)
- Devoluciones con reembolso proporcional
- Flujo de 3 pasos para devoluciones

### Usuarios y Roles
- **Admin (Jose)**: Acceso completo a todas las funciones
- **Vendedor (Rocio)**: POS, catálogo (consulta), inventario (consulta), ventas
- Tour guiado diferenciado por rol

### Configuración
- Gestión de tiendas
- Métodos de pago
- Plantilla de tickets
- Impresoras Bluetooth

### Auditoría
- Registro de todas las acciones sensibles
- Filtros por fecha, usuario, tipo de acción, entidad
- Detalle expandible con valores anteriores/nuevos

## Inicio Rápido (Local)

### Requisitos
- Node.js 20+
- Docker Desktop (para Supabase local)

### Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar Supabase local
npx supabase start

# 3. Aplicar migraciones y datos semilla
npx supabase db reset

# 4. Crear usuarios (Jose admin + Rocio vendedora)
node scripts/setup-users.js

# 5. Crear productos de ejemplo con stock
node scripts/seed-products.js

# 6. Añadir imágenes a los productos
node scripts/seed-images.js

# 7. Configurar variables de entorno
# Copiar las claves de `npx supabase status -o json` a .env.local

# 8. Iniciar el servidor de desarrollo
npm run dev
```

### Credenciales

| Usuario | Email | Contraseña | Rol |
|---------|-------|------------|-----|
| Jose | jose@shoestore.com | Admin123! | Admin |
| Rocio | rocio@shoestore.com | Vendedor1! | Vendedor |

### URLs Locales

| Servicio | URL |
|----------|-----|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| Supabase API | http://127.0.0.1:54321 |

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests unitarios + propiedades |
| `npm run test:unit` | Solo tests unitarios |
| `npm run test:property` | Solo tests de propiedades |
| `npm run test:coverage` | Tests con cobertura |
| `npm run lint` | ESLint |

## Estructura del Proyecto

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/login/       # Página de login
│   ├── (dashboard)/        # Layout con sidebar + topbar
│   │   ├── pos/            # Punto de Venta
│   │   ├── catalogo/       # Productos, categorías, marcas
│   │   ├── inventario/     # Stock, movimientos, ajustes, transferencias
│   │   ├── ventas/         # Historial, devoluciones
│   │   ├── usuarios/       # Gestión de usuarios
│   │   ├── config/         # Configuración
│   │   └── auditoria/      # Logs de auditoría
│   └── api/                # API Routes
├── components/
│   ├── ui/                 # Shadcn/ui components
│   ├── pos/                # Componentes del POS
│   ├── catalog/            # Formularios de catálogo
│   ├── inventory/          # Componentes de inventario
│   ├── layout/             # Sidebar, TopBar, StoreSelector
│   ├── dashboard/          # Widgets del dashboard
│   ├── shared/             # DataTable, Pagination, etc.
│   └── tour/               # Tour guiado (driver.js)
├── lib/
│   ├── supabase/           # Clientes Supabase
│   ├── printing/           # ESC/POS, Bluetooth, PDF
│   ├── validators/         # Schemas Zod
│   └── utils/              # SKU, moneda, impuestos
├── hooks/                  # useAuth, useCart, usePrinter, etc.
├── stores/                 # Zustand (auth, cart, printer)
└── types/                  # TypeScript types

supabase/
├── migrations/             # 12 migraciones SQL
├── seed.sql                # Datos semilla
└── config.toml             # Configuración local
```

## Base de Datos

12 migraciones que crean:
- Tablas de configuración (tiendas, tallas, colores, categorías, marcas, métodos de pago)
- Usuarios y asignación a tiendas
- Catálogo (productos, variantes, imágenes)
- Inventario (stock, movimientos, transferencias, ajustes)
- Ventas (tickets, líneas, pagos, secuencias)
- Devoluciones
- Auditoría y alertas
- Funciones PL/pgSQL atómicas (confirm_sale, process_return, execute_transfer, adjust_stock)
- Políticas RLS por rol
- Triggers de auditoría y alertas de stock bajo

## Tiendas

| Tienda | Código | Ubicación |
|--------|--------|-----------|
| Montellano | MON | C/ Real 45, 41770 Montellano, Sevilla |
| Morón de la Frontera | MOR | Av. de la Constitución 12, 41530 Morón de la Frontera, Sevilla |
