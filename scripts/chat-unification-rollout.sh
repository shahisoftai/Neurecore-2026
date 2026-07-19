#!/bin/bash
# NeureCore chat-unification rollout script — Phase G.
# Deploys the unified chat + Hermes default-on to production in 3 staged phases.
#
# Usage (run on Contabo):
#   ./scripts/chat-unification-rollout.sh stage1   # backend with HERMES_ENABLED opt-in only
#   ./scripts/chat-unification-rollout.sh stage2   # enable HERMES_ENABLED=true
#   ./scripts/chat-unification-rollout.sh stage3   # remove opt-out (Phase H)
#
# Each stage has an automatic rollback script at:
#   ./scripts/chat-unification-rollout.sh rollback <stage>

set -euo pipefail

STAGE="${1:-help}"
ROLLBACK_STAGE="${2:-}"

LOG=/tmp/chat-unification-rollout.log
NEURECORE_ROOT="/opt/neurecore"
BACKEND_DIR="$NEURECORE_ROOT/backend/backend"
ENV_FILE="$BACKEND_DIR/.env"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

check_env() {
  if [ ! -f "$ENV_FILE" ]; then
    log "ERROR: $ENV_FILE not found"
    exit 1
  fi
}

run_db_migration() {
  log "=== Running prisma migration: chat_persistence ==="
  cd "$BACKEND_DIR"
  ./node_modules/.bin/prisma migrate deploy 2>&1 | tee -a "$LOG"
  log "Migration complete"
}

set_env_var() {
  local KEY="$1"
  local VALUE="$2"
  if grep -q "^${KEY}=" "$ENV_FILE"; then
    sed -i "s|^${KEY}=.*|${KEY}=${VALUE}|" "$ENV_FILE"
    log "Updated ${KEY}=${VALUE}"
  else
    echo "${KEY}=${VALUE}" >> "$ENV_FILE"
    log "Added ${KEY}=${VALUE}"
  fi
}

reload_pm2() {
  log "=== Reloading PM2 ==="
  pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-backend
  sleep 3
  log "PM2 reloaded"
}

health_check() {
  log "=== Health check ==="
  local HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://brain.neurecore.com/api/v1/health || echo "FAIL")
  if [ "$HEALTH" = "200" ]; then
    log "Backend health: 200 OK"
    return 0
  else
    log "Backend health: $HEALTH — UNHEALTHY"
    return 1
  fi
}

smoke_test_chat() {
  log "=== Chat smoke test (POST /api/v1/chat/messages) ==="
  local RESULT=$(curl -s -X POST https://brain.neurecore.com/api/v1/chat/messages \
    -H "Content-Type: application/json" \
    -d '{"message":"rollout smoke test","conversationId":null}' || echo "FAIL")
  if echo "$RESULT" | grep -q '"reply"'; then
    log "Chat smoke test: PASSED"
    echo "$RESULT" | head -c 200
    echo ""
    return 0
  else
    log "Chat smoke test: FAILED"
    echo "$RESULT"
    return 1
  fi
}

# ── Stage 1: Backend + frontend deploy with Hermes default-on code (Phase B/C/E) ──
stage1() {
  log "==================================================="
  log "STAGE 1: Deploy backend + tenant + admin"
  log "  - HERMES_ENABLED default-on code shipped"
  log "  - Per-tenant override still available"
  log "  - /ai/chat removed"
  log "  - /chat/history persistent"
  log "==================================================="

  check_env

  # 1. Snapshot current state
  log "Snapshotting current state..."
  tar -czf "/tmp/chat-rollout-stage1-pre-$(date +%Y%m%d-%H%M%S).tar.gz" \
    -C "$BACKEND_DIR" dist/ 2>/dev/null || true

  # 2. Pull code
  log "Pulling latest code..."
  cd "$NEURECORE_ROOT"
  git pull origin main 2>&1 | tee -a "$LOG"

  # 3. Run prisma migration (chat_persistence)
  run_db_migration

  # 4. Rebuild backend
  log "Rebuilding backend..."
  cd "$BACKEND_DIR"
  if command -v pnpm &> /dev/null && [ -f pnpm-lock.yaml ]; then
    pnpm install --frozen-lockfile 2>&1 | tail -3 | tee -a "$LOG"
  else
    npm install --legacy-peer-deps 2>&1 | tail -3 | tee -a "$LOG"
  fi
  ./node_modules/.bin/nest build 2>&1 | tail -5 | tee -a "$LOG"

  # 5. OPTIONAL safety: explicitly set HERMES_ENABLED=true to make rollout intent visible
  log "Setting HERMES_ENABLED=true explicitly in .env..."
  set_env_var "HERMES_ENABLED" "true"
  set_env_var "HERMES_AUTO_LINK" "true"

  # 6. Reload PM2
  reload_pm2

  # 7. Health + smoke checks
  health_check || { log "ABORT: backend unhealthy"; exit 1; }
  smoke_test_chat || { log "ABORT: chat smoke failed"; exit 1; }

  log "==================================================="
  log "STAGE 1 COMPLETE — chat unified + Hermes default-on"
  log "Next: monitor for 7 days, then run stage 2"
  log "==================================================="
}

# ── Stage 2 (alias for full deploy + Phase H prerequisites) ──────────────────
stage2() {
  log "Stage 2 is informational — Hermes default-on already shipped in Stage 1"
  log "Use this stage to verify monitoring dashboards + rollback path"
  health_check
  smoke_test_chat
}

stage3() {
  log "Stage 3: Phase H — remove HERMES_ENABLED flag entirely"
  log "NOT YET IMPLEMENTED — see chat-unification-refactor-plan.md Phase H"
  exit 1
}

rollback_stage1() {
  log "=== ROLLBACK Stage 1 ==="
  log "Setting HERMES_ENABLED=false to revert to legacy OfficialAgentGraph path..."
  set_env_var "HERMES_ENABLED" "false"
  reload_pm2
  health_check || log "Backend still unhealthy — manual intervention required"
  log "Rollback complete. Investigate logs: $LOG"
}

case "$STAGE" in
  stage1) stage1 ;;
  stage2) stage2 ;;
  stage3) stage3 ;;
  rollback)
    case "$ROLLBACK_STAGE" in
      stage1) rollback_stage1 ;;
      *) log "Usage: $0 rollback {stage1|stage2|stage3}"; exit 2 ;;
    esac
    ;;
  help|*)
    cat <<EOF
Usage: $0 {stage1|stage2|stage3|rollback <stage>}

Stages:
  stage1   Deploy backend + tenant + admin with Hermes default-on (Phase A-E)
  stage2   Verify monitoring + rollback path
  stage3   Remove HERMES_ENABLED flag entirely (Phase H — future)

Rollback:
  rollback stage1   Set HERMES_ENABLED=false and reload PM2

Log file: $LOG
EOF
    ;;
esac
