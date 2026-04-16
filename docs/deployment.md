# Guía de Despliegue — ShoeStore POS & Inventario

## Arquitectura de Despliegue

```
┌──────────────────┐     ┌──────────────────────────────┐
│   Vercel          │     │   Supabase                    │
│   (Frontend)      │────▶│   (Backend / DB / Auth)       │
│                   │     │                                │
│   - Next.js SSR   │     │   - PostgreSQL + RLS           │
│   - API Routes    │     │   - Auth (JWT)                 │
│   - Static Assets │     │   - Storage (fotos)            │
│                   │     │   - Edge Functions              │
│                   │     │   - Realtime (alertas)          │
└──────────────────┘     └──────────────────────────────┘
```

---

## 1. Despliegue en Vercel

### 1.1 Configuración del Proyecto

1. Conectar el repositorio de GitHub a Vercel:
   - Ir a [vercel.com/new](https://vercel.com/new)
   - Seleccionar el repositorio `shoe-store-pos`
   - Vercel detectará automáticamente que es un proyecto Next.js

2. Configurar el framework:
   - **Framework Preset**: Next.js (auto-detectado)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (por defecto)
   - **Install Command**: `npm ci`

### 1.2 Variables de Entorno

Configurar las siguientes variables en Vercel → Settings → Environment Variables:

| Variable | Descripción | Entorno |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo server-side) | Production, Preview |

**Importante**: La variable `SUPABASE_SERVICE_ROLE_KEY` nunca debe exponerse al cliente. Solo se usa en API Routes y Server Components.

Para entornos de preview (PRs), se recomienda usar un proyecto Supabase de staging separado.

### 1.3 Configuración de Dominio

1. En Vercel → Settings → Domains, agregar el dominio personalizado
2. Vercel provee SSL automático vía Let's Encrypt
3. Configurar DNS según las instrucciones de Vercel (CNAME o A record)

### 1.4 Configuración de Preview Deployments

- Cada Pull Request genera un deployment de preview automáticamente
- Las variables de entorno de "Preview" se aplican a estos deployments
- Usar un proyecto Supabase de staging para previews

---

## 2. Configuración de Supabase en Producción

### 2.1 Crear Proyecto de Producción

1. Ir a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Crear un nuevo proyecto:
   - **Nombre**: `shoestore-production`
   - **Región**: Seleccionar la más cercana a los usuarios (ej: `us-east-1` o `sa-east-1` para LATAM)
   - **Plan**: Free (MVP) o Pro ($25/mes para producción)
   - **Contraseña de DB**: Generar una contraseña segura y guardarla

3. Anotar las credenciales del proyecto:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: Clave pública para el cliente
   - **Service Role Key**: Clave privada para el servidor

### 2.2 Aplicar Migraciones

Vincular el proyecto local con el proyecto de producción:

```bash
# Vincular con el proyecto remoto
npx supabase link --project-ref <project-ref>

# Aplicar todas las migraciones pendientes
npx supabase db push

# Verificar el estado de las migraciones
npx supabase migration list
```

### 2.3 Configurar Autenticación

1. En Supabase Dashboard → Authentication → Settings:
   - **Site URL**: `https://tu-dominio.com`
   - **Redirect URLs**: `https://tu-dominio.com/api/auth/callback`
   - **JWT Expiry**: 28800 (8 horas)
   - **Refresh Token Rotation**: Habilitado

2. Deshabilitar proveedores de auth no utilizados (solo Email/Password activo)

### 2.4 Configurar Storage

1. En Supabase Dashboard → Storage:
   - Crear bucket `product-images` (público para lectura)
   - Configurar políticas de acceso:
     - Lectura: pública (para servir imágenes)
     - Escritura: solo usuarios autenticados con rol Admin

### 2.5 Configurar Row Level Security

Las políticas RLS se aplican automáticamente con las migraciones. Verificar en Supabase Dashboard → Database → Tables que RLS está habilitado en todas las tablas sensibles.

### 2.6 Configurar Realtime

1. En Supabase Dashboard → Database → Replication:
   - Habilitar Realtime para la tabla `stock_alerts`
   - Esto permite que las alertas de stock bajo se propaguen en tiempo real

---

## 3. Flujo de Despliegue CI/CD

### 3.1 Ramas y Entornos

| Rama | Entorno | Supabase | Vercel |
|------|---------|----------|--------|
| `main` | Producción | Proyecto producción | Production deployment |
| `develop` | Staging | Proyecto staging | Preview deployment |
| `feature/*` | Preview | Proyecto staging | Preview deployment |

### 3.2 Proceso de Despliegue

1. **Desarrollo**: Crear rama `feature/xxx` desde `develop`
2. **Pull Request**: Abrir PR hacia `develop`
   - CI ejecuta: lint, type-check, tests unitarios, tests de propiedades
   - Vercel genera preview deployment
3. **Merge a develop**: Despliegue automático a staging
4. **Release**: Abrir PR de `develop` hacia `main`
   - Revisión final
5. **Merge a main**: Despliegue automático a producción

### 3.3 Migraciones de Base de Datos

Las migraciones de Supabase se aplican automáticamente como parte del pipeline de CD (ver sección 6).

Para aplicarlas manualmente:

```bash
# Staging
npx supabase link --project-ref <staging-ref>
npx supabase db push

# Producción
npx supabase link --project-ref <production-ref>
npx supabase db push
```

---

## 6. Automatización del Despliegue

### 6.1 Script de Despliegue Manual

El script `scripts/deploy.sh` automatiza todo el proceso de despliegue desde la terminal:

```bash
# Desplegar a staging
./scripts/deploy.sh staging

# Desplegar a producción
./scripts/deploy.sh production
```

El script ejecuta en orden:
1. Verifica la rama actual y cambios pendientes
2. Ejecuta lint, type-check y tests
3. Genera el build de producción
4. Aplica migraciones de Supabase
5. Despliega en Vercel

**Variables de entorno requeridas:**

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_PROJECT_REF_STAGING` | Ref del proyecto Supabase staging |
| `SUPABASE_PROJECT_REF_PRODUCTION` | Ref del proyecto Supabase producción |
| `SUPABASE_DB_PASSWORD` | Contraseña de la base de datos |

### 6.2 GitHub Actions — CD Automático

El workflow `.github/workflows/deploy.yml` automatiza el despliegue completo:

- **Push a `main`**: Despliega automáticamente a producción
- **Manual (workflow_dispatch)**: Permite elegir entre staging y producción

#### Secrets requeridos en GitHub

Configurar en Settings → Secrets and variables → Actions:

| Secret | Descripción |
|--------|-------------|
| `VERCEL_TOKEN` | Token de API de Vercel (`vercel tokens create`) |
| `VERCEL_ORG_ID` | ID de la organización en Vercel (`.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | ID del proyecto en Vercel (`.vercel/project.json`) |
| `SUPABASE_ACCESS_TOKEN` | Token de acceso de Supabase CLI |
| `SUPABASE_PROJECT_REF` | Ref del proyecto Supabase (por environment) |
| `SUPABASE_DB_PASSWORD` | Contraseña de la DB (por environment) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |

#### Usar GitHub Environments

Se recomienda crear dos environments en GitHub (Settings → Environments):
- **staging**: Con los secrets del proyecto Supabase de staging
- **production**: Con los secrets del proyecto Supabase de producción y protección de aprobación manual

#### Disparar despliegue manual

Ir a Actions → Deploy → Run workflow → Seleccionar entorno

---

## 4. Monitoreo y Mantenimiento

### 4.1 Vercel

- **Analytics**: Habilitar Vercel Analytics para métricas de rendimiento
- **Logs**: Vercel → Deployments → Logs para ver logs de API Routes
- **Speed Insights**: Monitorear Core Web Vitals

### 4.2 Supabase

- **Dashboard**: Monitorear uso de DB, storage y auth en el dashboard
- **Logs**: Database → Logs para queries lentas
- **Alertas**: Configurar alertas de uso en Settings → Billing

### 4.3 Backups

- **Supabase Pro**: Backups automáticos diarios incluidos
- **Supabase Free**: Exportar datos manualmente con `pg_dump` periódicamente

---

## 5. Estimación de Costos

| Componente | Free Tier | Pro ($25/mes) |
|------------|-----------|---------------|
| Vercel (Hobby) | $0 | $0 |
| Supabase DB | 500 MB | 8 GB |
| Supabase Storage | 1 GB | 100 GB |
| Supabase Auth | 50K MAU | 100K MAU |
| Supabase Edge Functions | 500K invocaciones | 2M invocaciones |
| **Total estimado** | **$0/mes** | **$25/mes** |

Para el MVP con 3 tiendas y ~15 usuarios, el tier gratuito es suficiente. Migrar a Pro cuando se necesite más capacidad o backups automáticos.
