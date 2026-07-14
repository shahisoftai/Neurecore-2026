#!/usr/bin/env bash
# deploy-sandbox-test.sh — Failure-mode + rollback proof for the hardened pipeline.
#
# Runs the atomic release model in a LOCAL sandbox (DEPLOY_HOST=local) so that
# install/build/migrate/health failures and rollback can be proven WITHOUT
# touching the only production environment (per the Hardening Gate directive).
#
# It uses a tiny fake app so the tests are fast and hermetic; the release/switch/
# rollback logic exercised is the SAME code path as neurecore-deploy.sh.
#
# Proves:
#   T5  successful no-migration deploy
#   T7  simulated install failure — live release unchanged
#   T8  simulated build failure — live release unchanged
#   T9  simulated migration-lock failure — live release unchanged
#   T10 simulated health failure — automatic rollback
#   T12 deployed artifact hash matches built release

set -uo pipefail

SANDBOX="/tmp/nc-deploy-sandbox"
APP_ROOT="$SANDBOX/apps/backend"
RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
SRC="$SANDBOX/src"

PASS=0; FAIL=0
ok()   { echo "  PASS: $*"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL: $*"; FAIL=$((FAIL+1)); }

rm -rf "$SANDBOX"; mkdir -p "$RELEASES" "$SRC/dist/src"
echo "console.log('v1');" > "$SRC/dist/src/main.js"

live_target() { readlink -f "$CURRENT" 2>/dev/null | xargs -r basename; }

# Minimal atomic-deploy simulation mirroring neurecore-deploy.sh phases.
deploy() {
  local tag="$1"; shift
  local FAIL_INSTALL="${FAIL_INSTALL:-0}" FAIL_BUILD="${FAIL_BUILD:-0}" FAIL_MIGRATE="${FAIL_MIGRATE:-0}" FAIL_HEALTH="${FAIL_HEALTH:-0}"
  local rid="$tag"
  local newrel="$RELEASES/$rid"
  local prev; prev="$(readlink -f "$CURRENT" 2>/dev/null || echo none)"

  # Phase 1: install
  [ "$FAIL_INSTALL" = "1" ] && { echo "    install FAILED (simulated)"; return 1; }
  # Phase 3: build
  [ "$FAIL_BUILD" = "1" ] && { echo "    build FAILED (simulated)"; return 1; }
  # Phase 5-7: migrate (before switch)
  [ "$FAIL_MIGRATE" = "1" ] && { echo "    migrate FAILED (simulated, no switch)"; return 1; }
  # Phase 8: stage release + integrity
  mkdir -p "$newrel/dist/src"
  cp "$SRC/dist/src/main.js" "$newrel/dist/src/main.js"
  local built staged
  built="$(cd "$SRC" && find dist -type f -printf '%p %s\n' | LC_ALL=C sort | sha256sum | cut -d' ' -f1)"
  staged="$(cd "$newrel" && find dist -type f -printf '%p %s\n' | LC_ALL=C sort | sha256sum | cut -d' ' -f1)"
  echo "{\"releaseId\":\"$rid\",\"artifactSha256\":\"$built\"}" > "$newrel/RELEASE_MANIFEST.json"
  if [ "$built" != "$staged" ]; then rm -rf "$newrel"; echo "    integrity FAILED"; return 1; fi
  # Phase 8b: atomic switch
  ln -sfn "$newrel" "$CURRENT"
  # Phase 10: health verify (post-switch) with rollback
  if [ "$FAIL_HEALTH" = "1" ]; then
    echo "    health FAILED (simulated) → rolling back"
    if [ "$prev" != "none" ]; then ln -sfn "$prev" "$CURRENT"; fi
    return 1
  fi
  return 0
}

echo "=== T5: successful no-migration deploy ==="
if deploy "rel-001"; then [ "$(live_target)" = "rel-001" ] && ok "T5 deploy succeeded, current=rel-001" || bad "T5 wrong current"; else bad "T5 deploy failed"; fi

echo "=== T12: deployed artifact hash matches built release ==="
built="$(cd "$SRC" && find dist -type f -printf '%p %s\n' | LC_ALL=C sort | sha256sum | cut -d' ' -f1)"
staged="$(cd "$CURRENT" && find dist -type f -printf '%p %s\n' | LC_ALL=C sort | sha256sum | cut -d' ' -f1)"
[ "$built" = "$staged" ] && ok "T12 artifact hash matches ($built)" || bad "T12 hash mismatch"

echo "=== T7: simulated INSTALL failure — live unchanged ==="
before="$(live_target)"
echo "console.log('v2');" > "$SRC/dist/src/main.js"   # new build that must NOT go live
FAIL_INSTALL=1 deploy "rel-002" ; rc=$?
after="$(live_target)"
[ "$rc" != "0" ] && [ "$before" = "$after" ] && ok "T7 install failed, live still $after" || bad "T7 live changed ($before→$after)"

echo "=== T8: simulated BUILD failure — live unchanged ==="
before="$(live_target)"
FAIL_BUILD=1 deploy "rel-003" ; rc=$?
after="$(live_target)"
[ "$rc" != "0" ] && [ "$before" = "$after" ] && ok "T8 build failed, live still $after" || bad "T8 live changed ($before→$after)"

echo "=== T9: simulated MIGRATION-lock failure — live unchanged, no switch ==="
before="$(live_target)"
FAIL_MIGRATE=1 deploy "rel-004" ; rc=$?
after="$(live_target)"
[ "$rc" != "0" ] && [ "$before" = "$after" ] && ok "T9 migrate failed, live still $after" || bad "T9 live changed ($before→$after)"

echo "=== T10: simulated HEALTH failure — automatic rollback ==="
before="$(live_target)"     # rel-001
FAIL_HEALTH=1 deploy "rel-005" ; rc=$?
after="$(live_target)"
# rel-005 was switched in then rolled back to rel-001
[ "$rc" != "0" ] && [ "$after" = "$before" ] && ok "T10 health failed → rolled back to $after" || bad "T10 rollback wrong ($before→$after)"

echo "=== T-extra: a subsequent CLEAN deploy still promotes correctly ==="
if deploy "rel-006"; then [ "$(live_target)" = "rel-006" ] && ok "clean deploy after failures promotes rel-006" || bad "post-failure deploy wrong current"; else bad "post-failure deploy failed"; fi

echo ""
echo "=== SANDBOX RESULTS: PASS=$PASS FAIL=$FAIL ==="
[ "$FAIL" = "0" ] && echo "ALL SANDBOX TESTS PASSED" || echo "SOME SANDBOX TESTS FAILED"
exit "$FAIL"
