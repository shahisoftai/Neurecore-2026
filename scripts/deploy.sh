#!/bin/bash
# NeureCore — push-to-Contabo deploy orchestrator.
# Run FROM LOCAL WORKSPACE. Syncs source, then triggers the on-server rebuild.
#
# Usage:
#   ./scripts/deploy.sh tenant   # sync + rebuild frontend-tenant
#   ./scripts/deploy.sh admin    # sync + rebuild frontend-admin
#   ./scripts/deploy.sh backend  # sync src+prisma + rebuild backend
#   ./scripts/deploy.sh all      # sync + rebuild all three
#
# Requires:
#   - ssh alias `contabo` (root@109.123.248.253)
#   - rsync, ssh on PATH
#   - sshpass or pre-shared key (the contabo alias uses key auth)

set -euo pipefail

APP="${1:-}"
LOCAL_ROOT="/home/najeeb/Linux-Dev/neurecore-2026/neurecore"
REMOTE_ROOT="contabo:/opt/neurecore"

# Per-app source → destination mapping
declare -A APP_SRC=(
  [tenant]="$LOCAL_ROOT/frontend-tenant"
  [admin]="$LOCAL_ROOT/frontend-admin"
  [backend]="$LOCAL_ROOT/backend"
)
declare -A APP_DST=(
  [tenant]="$REMOTE_ROOT/frontend-tenant"
  [admin]="$REMOTE_ROOT/frontend-admin"
  [backend]="$REMOTE_ROOT/backend/backend"
)

EXCLUDES=(
  --exclude=node_modules
  --exclude=.next
  --exclude=dist
  --exclude=coverage
  --exclude=test
  --exclude=.env
  --exclude=.env.local
  --exclude=.env.production
  --exclude=tsconfig.tsbuildinfo
  --exclude=.git
)

sync_app() {
  local app="$1"
  local src="${APP_SRC[$app]}"
  local dst="${APP_DST[$app]}"
  echo ""
  echo "=== Syncing $app: $src → $dst ==="
  # --delete-after: remove files on dst that no longer exist in src, AFTER
  # the transfer so a partial sync doesn't delete files we didn't replace.
  rsync -avz --delete-after -e ssh "${EXCLUDES[@]}" "$src/" "$dst/"
}

check_ports() {
  local app="$1"
  if [ "$app" = "tenant" ] || [ "$app" = "all" ]; then
    local tenant_port
    tenant_port=$(grep -oP '\-\-port \K[0-9]+' "$LOCAL_ROOT/frontend-tenant/start.sh")
    if [ "$tenant_port" != "3001" ]; then
      echo "ERROR: tenant start.sh port is $tenant_port, expected 3001"
      exit 1
    fi
    echo "  tenant start.sh port OK: $tenant_port"
  fi
  if [ "$app" = "admin" ] || [ "$app" = "all" ]; then
    local admin_port
    admin_port=$(grep -oP '\-\-port \K[0-9]+' "$LOCAL_ROOT/frontend-admin/start.sh")
    if [ "$admin_port" != "3020" ]; then
      echo "ERROR: admin start.sh port is $admin_port, expected 3020"
      exit 1
    fi
    echo "  admin start.sh port OK: $admin_port"
  fi
}

if [ -z "$APP" ]; then
  echo "Usage: $0 {tenant|admin|backend|all}" >&2
  exit 2
fi

case "$APP" in
  tenant|admin|backend)
    check_ports "$APP"
    sync_app "$APP"
    ssh contabo "bash /opt/neurecore/rebuild.sh $APP"
    ;;
  all)
    for a in tenant admin backend; do
      sync_app "$a"
    done
    ssh contabo "bash /opt/neurecore/rebuild.sh all"
    ;;
  *)
    echo "Unknown app: $APP" >&2
    echo "Usage: $0 {tenant|admin|backend|all}" >&2
    exit 2
    ;;
esac

echo ""
echo "=== Deploy finished: $APP ==="
echo "Smoke tests:"
echo "  curl -sk https://brain.neurecore.com/api/v1/health"
echo "  curl -sk -o /dev/null -w 'hq %{http_code}\n' https://hq.neurecore.com/"
echo "  curl -sk -o /dev/null -w 'cc %{http_code}\n' https://cc.neurecore.com/"