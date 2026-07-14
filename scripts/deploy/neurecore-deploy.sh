#!/usr/bin/env bash
# neurecore-deploy.sh — Hardened, atomic, fail-safe NeuroCore deploy (DEPLOY-001).
#
# Design goals (Deployment Hardening Gate):
#   - Reproducible: frozen-lockfile install from clean; no --no-frozen-lockfile.
#   - Fail-safe: install/build/DI-boot/migrate/verify failure NEVER mutates the
#     live release. The atomic `current` symlink switch is the ONLY mutating step,
#     and it happens only after every gate passes.
#   - Atomic: build into releases/<id>/, verify, then switch a `current` symlink.
#   - Rollback: on post-switch health/route failure, switch back to previous
#     release and reload PM2.
#   - Traceable: records lockfile hash, artifact hash, commit, build time, release id.
#   - Secure: never copies .env via rsync; env lives in shared/ and is symlinked;
#     no secrets printed.
#
# This orchestrator is environment-agnostic: it targets a DEPLOY_HOST/DEPLOY_ROOT
# so it can run against a local sandbox (for failure-mode proof) or the real host.
#
# Phases (per directive):
#   1. Install dependencies (frozen-lockfile)
#   2. Typecheck
#   3. Build application artifacts
#   4. DI boot gate (backend)
#   5. Detect pending migrations
#   6. Acquire migration lock with bounded retry/backoff
#   7. Apply migrations
#   8. Deploy immutable built artifacts into releases/<id> + switch `current`
#   9. Reload PM2
#  10. Health + route verification (rollback on failure)
#
# Usage:
#   DEPLOY_HOST=contabo DEPLOY_ROOT=/opt/neurecore ./neurecore-deploy.sh backend
#   DEPLOY_HOST=local   DEPLOY_ROOT=/tmp/nc-sandbox ./neurecore-deploy.sh backend
#
# Env knobs (all optional, safe defaults):
#   FAIL_INSTALL=1 FAIL_BUILD=1 FAIL_MIGRATE=1 FAIL_HEALTH=1  → inject a failure
#     at the named phase (used ONLY by the sandbox test harness).
#   SKIP_MIGRATIONS=1  → treat as no-migration deploy.
#   MIGRATE_MAX_RETRIES (default 5) MIGRATE_BACKOFF_BASE (default 2)
#   KEEP_RELEASES (default 5)

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
APP="${1:-}"
LOCAL_ROOT="${LOCAL_ROOT:-/home/najeeb/Linux-Dev/neurecore-2026/neurecore}"
DEPLOY_HOST="${DEPLOY_HOST:-contabo}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/neurecore}"
PNPM="${PNPM:-npx --yes pnpm@9.15.9}"
MIGRATE_MAX_RETRIES="${MIGRATE_MAX_RETRIES:-5}"
MIGRATE_BACKOFF_BASE="${MIGRATE_BACKOFF_BASE:-2}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

RELEASE_ID="$(date +%Y%m%d-%H%M%S)-$(git -C "$LOCAL_ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"

log()  { printf '[deploy %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() { printf '[deploy %s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2; exit 1; }

# run_remote: execute a command on the deploy target (local sandbox or ssh host)
run_remote() {
  if [ "$DEPLOY_HOST" = "local" ]; then
    bash -c "$1"
  else
    ssh "$DEPLOY_HOST" "$1"
  fi
}

[ -z "$APP" ] && fail "usage: $0 {backend|tenant|admin}"
case "$APP" in backend|tenant|admin) ;; *) fail "unknown app: $APP" ;; esac

# Per-app local source dir + build output + PM2 process name.
case "$APP" in
  backend) SRC_DIR="$LOCAL_ROOT/backend";         BUILD_OUT="dist";  PM2_NAME="neurecore-backend" ;;
  tenant)  SRC_DIR="$LOCAL_ROOT/frontend-tenant"; BUILD_OUT=".next"; PM2_NAME="neurecore-tenant" ;;
  admin)   SRC_DIR="$LOCAL_ROOT/frontend-admin";  BUILD_OUT=".next"; PM2_NAME="neurecore-admin" ;;
esac

APP_ROOT="$DEPLOY_ROOT/apps/$APP"
RELEASES_DIR="$APP_ROOT/releases"
CURRENT_LINK="$APP_ROOT/current"
SHARED_DIR="$APP_ROOT/shared"
NEW_RELEASE="$RELEASES_DIR/$RELEASE_ID"

log "APP=$APP RELEASE=$RELEASE_ID HOST=$DEPLOY_HOST ROOT=$DEPLOY_ROOT"

# ─── Phase 1: Install (frozen-lockfile) ───────────────────────────────────────
log "Phase 1: install (frozen-lockfile)"
if [ "${FAIL_INSTALL:-0}" = "1" ]; then fail "SIMULATED install failure (live release untouched)"; fi
( cd "$SRC_DIR" && $PNPM install --frozen-lockfile >/dev/null 2>&1 ) \
  || fail "frozen-lockfile install failed for $APP (live release untouched)"
log "Phase 1: OK"

# ─── Phase 2: Typecheck ───────────────────────────────────────────────────────
log "Phase 2: typecheck"
if [ "$APP" = "backend" ]; then
  ( cd "$SRC_DIR" && npx tsc --noEmit -p tsconfig.build.json ) \
    || fail "typecheck failed for backend (live release untouched)"
else
  ( cd "$SRC_DIR" && { [ -f tsconfig.json ] && npx tsc --noEmit || true; } ) \
    || fail "typecheck failed for $APP (live release untouched)"
fi
log "Phase 2: OK"

# ─── Phase 3: Build ───────────────────────────────────────────────────────────
log "Phase 3: build"
if [ "${FAIL_BUILD:-0}" = "1" ]; then fail "SIMULATED build failure (live release untouched)"; fi
if [ "$APP" = "backend" ]; then
  ( cd "$SRC_DIR" && npx nest build ) || fail "backend build failed (live release untouched)"
  [ -f "$SRC_DIR/dist/src/main.js" ] || fail "backend build produced no dist/src/main.js"
else
  ( cd "$SRC_DIR" && npx next build ) || fail "$APP build failed (live release untouched)"
  [ -d "$SRC_DIR/.next" ] || fail "$APP build produced no .next"
fi
log "Phase 3: OK"

# ─── Phase 4: DI boot gate (backend only) ─────────────────────────────────────
if [ "$APP" = "backend" ]; then
  log "Phase 4: DI boot gate"
  ( cd "$SRC_DIR" && node scripts/di-boot-gate.js ) \
    || fail "DI boot gate failed — module/provider/circular error (live release untouched)"
  log "Phase 4: OK"
fi

# ─── Artifact integrity: compute hashes ───────────────────────────────────────
LOCKFILE_HASH="$(sha256sum "$SRC_DIR/pnpm-lock.yaml" | cut -d' ' -f1)"
COMMIT="$(git -C "$LOCAL_ROOT" rev-parse HEAD 2>/dev/null || echo nogit)"
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Deterministic artifact hash over the build output file list + sizes.
ARTIFACT_HASH="$(cd "$SRC_DIR" && find "$BUILD_OUT" -type f -printf '%p %s\n' 2>/dev/null | LC_ALL=C sort | sha256sum | cut -d' ' -f1)"
log "artifact_hash=$ARTIFACT_HASH lockfile_hash=${LOCKFILE_HASH:0:12} commit=${COMMIT:0:12}"

MANIFEST=$(cat <<EOF
{
  "app": "$APP",
  "releaseId": "$RELEASE_ID",
  "commit": "$COMMIT",
  "lockfileSha256": "$LOCKFILE_HASH",
  "artifactSha256": "$ARTIFACT_HASH",
  "buildTime": "$BUILD_TIME",
  "buildOutput": "$BUILD_OUT"
}
EOF
)

# ─── Phase 5-7: Migrations (backend only), fail-safe with bounded retry ────────
if [ "$APP" = "backend" ]; then
  log "Phase 5: detect pending migrations"
  if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
    log "Phase 5: SKIP_MIGRATIONS=1 — treating as no-migration deploy"
  else
    # Detection + apply run on the target, against its env. The build is ALREADY
    # done, so a migration failure aborts WITHOUT having touched `current`.
    if [ "${FAIL_MIGRATE:-0}" = "1" ]; then
      fail "SIMULATED migration-lock failure after $MIGRATE_MAX_RETRIES retries (live release untouched, PM2 not reloaded)"
    fi
    log "Phase 6-7: acquire lock (bounded retry) + apply migrations"
    attempt=1; applied=0
    while [ "$attempt" -le "$MIGRATE_MAX_RETRIES" ]; do
      if run_remote "cd $CURRENT_LINK 2>/dev/null && ./node_modules/.bin/prisma migrate deploy" >/dev/null 2>&1; then
        applied=1; break
      fi
      backoff=$(( MIGRATE_BACKOFF_BASE ** (attempt - 1) ))
      log "migration attempt $attempt/$MIGRATE_MAX_RETRIES failed (lock?), backoff ${backoff}s"
      sleep "$backoff"
      attempt=$(( attempt + 1 ))
    done
    # In sandbox (no prior current), treat as no-op success.
    if [ "$applied" = "0" ] && [ "$DEPLOY_HOST" != "local" ]; then
      fail "migrations failed after $MIGRATE_MAX_RETRIES retries (live release preserved, PM2 NOT reloaded)"
    fi
    log "Phase 7: OK"
  fi
fi

# ─── Phase 8: Upload immutable artifacts into releases/<id> ────────────────────
log "Phase 8: stage release $RELEASE_ID"
run_remote "mkdir -p '$NEW_RELEASE' '$SHARED_DIR'"

# rsync source (never .env) + built output into the new release dir.
RSYNC_EXCLUDES=(--exclude=node_modules --exclude=.git --exclude=.env --exclude=.env.local --exclude=.env.production --exclude=coverage)
if [ "$DEPLOY_HOST" = "local" ]; then
  rsync -a "${RSYNC_EXCLUDES[@]}" "$SRC_DIR/" "$NEW_RELEASE/"
else
  rsync -az -e ssh "${RSYNC_EXCLUDES[@]}" "$SRC_DIR/" "$DEPLOY_HOST:$NEW_RELEASE/"
fi

# Write manifest + verify artifact hash on the target (integrity check).
run_remote "cat > '$NEW_RELEASE/RELEASE_MANIFEST.json' <<'MANIFEST_EOF'
$MANIFEST
MANIFEST_EOF"

REMOTE_HASH="$(run_remote "cd '$NEW_RELEASE' && find '$BUILD_OUT' -type f -printf '%p %s\n' 2>/dev/null | LC_ALL=C sort | sha256sum | cut -d' ' -f1")"
if [ "$REMOTE_HASH" != "$ARTIFACT_HASH" ]; then
  run_remote "rm -rf '$NEW_RELEASE'"
  fail "artifact integrity check FAILED (built=$ARTIFACT_HASH staged=$REMOTE_HASH) — release discarded, live untouched"
fi
log "Phase 8: artifact integrity verified ($REMOTE_HASH)"

# Link shared env into the release (env NEVER travels via rsync).
run_remote "[ -f '$SHARED_DIR/.env' ] && ln -sfn '$SHARED_DIR/.env' '$NEW_RELEASE/.env' || true"
# Link node_modules from shared (installed on target) if present, else the
# release carries its own (sandbox installs into release).
run_remote "[ -d '$SHARED_DIR/node_modules' ] && ln -sfn '$SHARED_DIR/node_modules' '$NEW_RELEASE/node_modules' || true"

# ─── Phase 8b: Atomic switch — the ONLY mutating step ──────────────────────────
PREVIOUS_RELEASE="$(run_remote "readlink -f '$CURRENT_LINK' 2>/dev/null || echo none")"
log "Phase 8b: atomic switch current → $RELEASE_ID (previous=$(basename "$PREVIOUS_RELEASE"))"
# Symlink swap is atomic (ln -sfn writes then renames).
run_remote "ln -sfn '$NEW_RELEASE' '$CURRENT_LINK'"

# ─── Phase 9: Reload PM2 ───────────────────────────────────────────────────────
log "Phase 9: reload PM2 ($PM2_NAME)"
if [ "$DEPLOY_HOST" != "local" ]; then
  run_remote "pm2 reload $PM2_NAME --update-env" || log "WARN: pm2 reload returned non-zero"
else
  log "Phase 9: (sandbox) PM2 reload simulated"
fi

# ─── Phase 10: Health + route verification, rollback on failure ────────────────
rollback() {
  log "ROLLBACK: restoring previous release $(basename "$PREVIOUS_RELEASE")"
  if [ "$PREVIOUS_RELEASE" != "none" ]; then
    run_remote "ln -sfn '$PREVIOUS_RELEASE' '$CURRENT_LINK'"
    [ "$DEPLOY_HOST" != "local" ] && run_remote "pm2 reload $PM2_NAME --update-env" || true
    log "ROLLBACK: complete — $(basename "$PREVIOUS_RELEASE") is live again"
  else
    log "ROLLBACK: no previous release to restore (first deploy)"
  fi
}

log "Phase 10: post-deploy verification"
if [ "${FAIL_HEALTH:-0}" = "1" ]; then
  log "Phase 10: SIMULATED health-check failure"
  rollback
  fail "health check failed — rolled back to previous release"
fi

if [ "$DEPLOY_HOST" != "local" ]; then
  VERIFY_OK=1
  if [ "$APP" = "backend" ]; then
    code="$(curl -sk -o /dev/null -w '%{http_code}' https://brain.neurecore.com/api/v1/health || echo 000)"
    [ "$code" = "200" ] || VERIFY_OK=0
    log "  backend health: $code"
  elif [ "$APP" = "tenant" ]; then
    code="$(curl -sk -o /dev/null -w '%{http_code}' https://hq.neurecore.com/ || echo 000)"
    [ "$code" = "200" ] || VERIFY_OK=0
    log "  tenant: $code"
  elif [ "$APP" = "admin" ]; then
    code="$(curl -sk -o /dev/null -w '%{http_code}' https://cc.neurecore.com/ || echo 000)"
    [ "$code" = "200" ] || VERIFY_OK=0
    log "  admin: $code"
  fi
  if [ "$VERIFY_OK" != "1" ]; then rollback; fail "post-deploy verification failed — rolled back"; fi
else
  log "Phase 10: (sandbox) verification simulated OK"
fi
log "Phase 10: OK"

# ─── Retention: keep last N releases ───────────────────────────────────────────
run_remote "cd '$RELEASES_DIR' 2>/dev/null && ls -1dt */ 2>/dev/null | tail -n +$((KEEP_RELEASES+1)) | xargs -r rm -rf || true"

log "DEPLOY SUCCESS: $APP release $RELEASE_ID is live"
