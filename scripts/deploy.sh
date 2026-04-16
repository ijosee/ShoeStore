#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ShoeStore POS & Inventario — Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
# Automatiza el despliegue a staging o producción.
#
# Uso:
#   ./scripts/deploy.sh staging     # Despliega a staging
#   ./scripts/deploy.sh production  # Despliega a producción
#
# Requisitos:
#   - Supabase CLI instalado y autenticado (npx supabase login)
#   - Vercel CLI instalado y autenticado (npx vercel login)
#   - Variables de entorno configuradas (ver abajo)
#
# Variables de entorno requeridas:
#   SUPABASE_PROJECT_REF_STAGING    — Ref del proyecto Supabase staging
#   SUPABASE_PROJECT_REF_PRODUCTION — Ref del proyecto Supabase producción
#   SUPABASE_DB_PASSWORD            — Contraseña de la base de datos
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Funciones auxiliares ─────────────────────────────────────────────────────
log_info()  { echo -e "${BLUE}ℹ${NC} $1"; }
log_ok()    { echo -e "${GREEN}✔${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✖${NC} $1"; }

# ─── Validar argumentos ──────────────────────────────────────────────────────
ENVIRONMENT="${1:-}"

if [[ -z "$ENVIRONMENT" ]]; then
  echo ""
  echo "Uso: ./scripts/deploy.sh <entorno>"
  echo ""
  echo "Entornos disponibles:"
  echo "  staging     — Despliega a staging (rama develop)"
  echo "  production  — Despliega a producción (rama main)"
  echo ""
  exit 1
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  log_error "Entorno inválido: $ENVIRONMENT"
  echo "Usa 'staging' o 'production'"
  exit 1
fi

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ShoeStore POS — Despliegue a ${ENVIRONMENT^^}"
echo "══════════════════════════════════════════════════════════"
echo ""

# ─── Determinar configuración según entorno ───────────────────────────────────
if [[ "$ENVIRONMENT" == "staging" ]]; then
  SUPABASE_REF="${SUPABASE_PROJECT_REF_STAGING:?Variable SUPABASE_PROJECT_REF_STAGING no definida}"
  VERCEL_ENV="preview"
  EXPECTED_BRANCH="develop"
else
  SUPABASE_REF="${SUPABASE_PROJECT_REF_PRODUCTION:?Variable SUPABASE_PROJECT_REF_PRODUCTION no definida}"
  VERCEL_ENV="production"
  EXPECTED_BRANCH="main"
fi

# ─── Paso 1: Verificar rama actual ───────────────────────────────────────────
CURRENT_BRANCH=$(git branch --show-current)
log_info "Rama actual: $CURRENT_BRANCH"

if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  log_warn "Se esperaba la rama '$EXPECTED_BRANCH' para despliegue a $ENVIRONMENT"
  read -p "¿Continuar de todas formas? (s/N): " CONFIRM
  if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
    log_info "Despliegue cancelado."
    exit 0
  fi
fi

# ─── Paso 2: Verificar que no hay cambios sin commitear ──────────────────────
if [[ -n "$(git status --porcelain)" ]]; then
  log_warn "Hay cambios sin commitear:"
  git status --short
  echo ""
  read -p "¿Continuar de todas formas? (s/N): " CONFIRM
  if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
    log_info "Despliegue cancelado. Haz commit de tus cambios primero."
    exit 0
  fi
fi

# ─── Paso 3: Ejecutar checks de calidad ──────────────────────────────────────
log_info "Ejecutando verificaciones de calidad..."

echo ""
log_info "→ Lint..."
npm run lint
log_ok "Lint pasó"

echo ""
log_info "→ Type check..."
npx tsc --noEmit
log_ok "Type check pasó"

echo ""
log_info "→ Tests unitarios..."
npm run test:unit
log_ok "Tests unitarios pasaron"

echo ""
log_info "→ Tests de propiedades..."
npm run test:property
log_ok "Tests de propiedades pasaron"

# ─── Paso 4: Build de producción ─────────────────────────────────────────────
echo ""
log_info "Generando build de producción..."
npm run build
log_ok "Build completado"

# ─── Paso 5: Migraciones de Supabase ─────────────────────────────────────────
echo ""
log_info "Aplicando migraciones de Supabase a $ENVIRONMENT..."
npx supabase link --project-ref "$SUPABASE_REF"
npx supabase db push
log_ok "Migraciones aplicadas"

# ─── Paso 6: Despliegue en Vercel ────────────────────────────────────────────
echo ""
log_info "Desplegando en Vercel ($VERCEL_ENV)..."

if [[ "$VERCEL_ENV" == "production" ]]; then
  npx vercel --prod --yes
else
  npx vercel --yes
fi

log_ok "Despliegue en Vercel completado"

# ─── Resumen ──────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo -e "  ${GREEN}✔ Despliegue a ${ENVIRONMENT^^} completado${NC}"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "Resumen:"
echo "  • Rama:       $CURRENT_BRANCH"
echo "  • Entorno:    $ENVIRONMENT"
echo "  • Supabase:   Migraciones aplicadas ($SUPABASE_REF)"
echo "  • Vercel:     Desplegado ($VERCEL_ENV)"
echo ""
