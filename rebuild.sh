#!/bin/bash
# NeureCore on-Contabo rebuild script.
# Run ON CONTABO (via `ssh contabo 'bash /opt/neurecore/rebuild.sh <app>'`),
# OR copy /opt/neurecore/ecosystem.config.js + this script together.
#
# Usage:
#   ./rebuild.sh tenant   # rebuild only frontend-tenant
#   ./rebuild.sh admin    # rebuild only frontend-admin
#   ./rebuild.sh backend  # rebuild only backend (NestJS + prisma)
#   ./rebuild.sh all      # rebuild all three + reload PM2
#
# Replaces the old /var/www/... rebuild.sh that targeted a now-defunct layout.

set -euo pipefail

LOG=/tmp/rebuild.log
APP="${1:-all}"
echo "=== Rebuild started ($(date)) app=$APP ===" | tee -a "$LOG"

NEURECORE_ROOT="/opt/neurecore"
BACKEND_DIR="$NEURECORE_ROOT/backend/backend"
TENANT_DIR="$NEURECORE_ROOT/frontend-tenant"
ADMIN_DIR="$NEURECORE_ROOT/frontend-admin"
ECOSYSTEM="$NEURECORE_ROOT/ecosystem.config.js"

rebuild_backend() {
  echo "" | tee -a "$LOG"
  echo "=== Rebuilding backend ($(date)) ===" | tee -a "$LOG"
  cd "$BACKEND_DIR"

  # 1. Snapshot current dist + working tree (defensive)
  tar -czf "/tmp/dist-backup-$(date +%Y%m%d-%H%M%S).tar.gz" dist/ 2>/dev/null || true

  # 2. Pull deps + regen Prisma client
  npm ci --omit=dev=false 2>&1 | tail -5
  if [ -f .env ]; then
    set +u
    export $(grep -v '^#' .env | grep -E 'DATABASE_URL|DIRECT_URL' | xargs)
    set -u
  fi
  ./node_modules/.bin/prisma generate 2>&1 | tail -3
  ./node_modules/.bin/prisma migrate deploy 2>&1 | tail -5

  # 3. Compile
  ./node_modules/.bin/nest build 2>&1 | tail -5

  # 4. Reload via ecosystem
  pm2 startOrReload "$ECOSYSTEM" --only neurecore-backend
  echo "=== BACKEND_DONE $(date) ===" | tee -a "$LOG"
}

rebuild_tenant() {
  echo "" | tee -a "$LOG"
  echo "=== Rebuilding tenant ($(date)) ===" | tee -a "$LOG"
  cd "$TENANT_DIR"

  npm ci --omit=dev=false 2>&1 | tail -5
  ./node_modules/.bin/next build 2>&1 | tail -10

  pm2 startOrReload "$ECOSYSTEM" --only neurecore-tenant
  echo "=== TENANT_DONE $(date) ===" | tee -a "$LOG"
}

rebuild_admin() {
  echo "" | tee -a "$LOG"
  echo "=== Rebuilding admin ($(date)) ===" | tee -a "$LOG"
  cd "$ADMIN_DIR"

  npm ci --omit=dev=false 2>&1 | tail -5
  ./node_modules/.bin/next build 2>&1 | tail -10

  pm2 startOrReload "$ECOSYSTEM" --only neurecore-admin
  echo "=== ADMIN_DONE $(date) ===" | tee -a "$LOG"
}

case "$APP" in
  tenant)  rebuild_tenant ;;
  admin)   rebuild_admin ;;
  backend) rebuild_backend ;;
  all)
    rebuild_tenant
    rebuild_admin
    rebuild_backend
    pm2 save
    ;;
  *)
    echo "Usage: $0 {tenant|admin|backend|all}" >&2
    exit 2
    ;;
esac

echo "" | tee -a "$LOG"
echo "=== ALL_DONE $(date) ===" | tee -a "$LOG"