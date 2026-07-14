#!/usr/bin/env bash
# post-deploy-smoke.sh — Read-only post-deploy verification for NeuroCore.
#
# Safe to run against production: performs ONLY GET/health checks and
# unauthenticated route-resolution probes. It does NOT create data.
#
# Deeper authenticated EIE checks (information-requirements / next-question /
# response recording) require a dedicated test tenant + token and are gated
# behind SMOKE_TOKEN + SMOKE_PROJECT_ID to avoid mutating real tenants.
#
# Exit 0 → all checks passed. Exit 1 → a check failed (deployment should roll back).

set -uo pipefail

BACKEND="${BACKEND_URL:-https://brain.neurecore.com}"
TENANT="${TENANT_URL:-https://hq.neurecore.com}"
ADMIN="${ADMIN_URL:-https://cc.neurecore.com}"

fails=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "  PASS: $1 ($3)"; else echo "  FAIL: $1 (expected $2, got $3)"; fails=$((fails+1)); fi
}

code() { curl -sk -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || echo 000; }

echo "=== Post-deploy smoke ($(date -u +%H:%M:%SZ)) ==="

# 1. Backend health
check "backend health" "200" "$(code "$BACKEND/api/v1/health")"

# 2. Frontends serve
check "tenant serves" "200" "$(code "$TENANT/")"
check "admin serves"  "200" "$(code "$ADMIN/")"

# 3. EIE route resolution (unauth → 401 proves the route RESOLVES, not 404).
#    A 404 here would mean the EIE routing regression (Phase 1) has returned.
check "EIE information-requirements resolves" "401" "$(code "$BACKEND/api/v1/projects/smoke-test-id/information-requirements")"
check "EIE next-question resolves"            "401" "$(code "$BACKEND/api/v1/projects/smoke-test-id/next-question")"

# 4. Optional authenticated EIE behavioural smoke (dedicated test tenant only).
if [ -n "${SMOKE_TOKEN:-}" ] && [ -n "${SMOKE_PROJECT_ID:-}" ]; then
  echo "  (authenticated EIE smoke enabled)"
  ir="$(curl -sk -o /dev/null -w '%{http_code}' -H "Cookie: ${SMOKE_TOKEN}" \
        "$BACKEND/api/v1/projects/${SMOKE_PROJECT_ID}/information-requirements")"
  check "EIE information-requirements (auth)" "200" "$ir"
  nq="$(curl -sk -o /dev/null -w '%{http_code}' -H "Cookie: ${SMOKE_TOKEN}" \
        "$BACKEND/api/v1/projects/${SMOKE_PROJECT_ID}/next-question")"
  check "EIE next-question (auth)" "200" "$nq"
fi

echo ""
if [ "$fails" = "0" ]; then echo "SMOKE OK"; exit 0; else echo "SMOKE FAILED ($fails)"; exit 1; fi
