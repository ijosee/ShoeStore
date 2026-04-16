#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ShoeStore POS & Inventario — Local Development Setup
# ═══════════════════════════════════════════════════════════════════════════════
# This script initializes the local Supabase environment, applies all
# migrations, and seeds the database with initial configuration data.
#
# Prerequisites:
#   - Supabase CLI installed (https://supabase.com/docs/guides/cli)
#   - Docker running
#
# Usage:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

echo "══════════════════════════════════════════════════════════"
echo "  ShoeStore POS — Inicialización del entorno local"
echo "══════════════════════════════════════════════════════════"
echo ""

# 1. Start Supabase local services
echo "▶ Iniciando servicios de Supabase..."
supabase start
echo ""

# 2. Reset database (applies migrations + seed data)
echo "▶ Aplicando migraciones y datos semilla..."
supabase db reset
echo ""

# 3. Display connection info
echo "══════════════════════════════════════════════════════════"
echo "  ✔ Entorno local listo"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "Servicios disponibles:"
echo "  • Studio:   http://127.0.0.1:54323"
echo "  • API:      http://127.0.0.1:54321"
echo "  • DB:       postgresql://postgres:postgres@127.0.0.1:54322/postgres"
echo "  • Inbucket: http://127.0.0.1:54324"
echo ""

# 4. Instructions for creating the admin user
echo "══════════════════════════════════════════════════════════"
echo "  Crear usuario administrador"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "Para crear el usuario admin, ejecuta los siguientes pasos:"
echo ""
echo "  1. Abre Supabase Studio: http://127.0.0.1:54323"
echo ""
echo "  2. Ve a Authentication > Users > Add User y crea:"
echo "       Email:    admin@shoestore.com"
echo "       Password: Admin123!"
echo ""
echo "  3. Copia el UUID del usuario creado y ejecuta en el SQL Editor:"
echo ""
echo "     INSERT INTO public.users (id, email, full_name, role)"
echo "     VALUES ('<UUID>', 'admin@shoestore.com', 'Carlos Admin', 'admin');"
echo ""
echo "     INSERT INTO public.user_stores (user_id, store_id)"
echo "     VALUES"
echo "       ('<UUID>', 'a0000000-0000-0000-0000-000000000001'),"
echo "       ('<UUID>', 'a0000000-0000-0000-0000-000000000002'),"
echo "       ('<UUID>', 'a0000000-0000-0000-0000-000000000003');"
echo ""
echo "══════════════════════════════════════════════════════════"
