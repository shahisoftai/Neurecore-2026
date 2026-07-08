#!/usr/bin/env bash
# ─── scripts/auth-lint.sh ─────────────────────────────────────────────────────
# FIX-020 Phase 9: CI enforcement — fail the build if any banned auth pattern
# sneaks back in.
#
#   bash scripts/auth-lint.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TENANT="$ROOT/frontend-tenant/src"
ADMIN="$ROOT/frontend-admin/src"
TOOLS="$ROOT/tools/eslint-rules"

FAIL=0

# ─── 1. No localStorage/sessionStorage writes for auth keys outside auth/ ─────
AUTH_KEYS='(token|access|refresh|csrf|auth|user|role|session|password)'

echo "[auth-lint] Checking localStorage/sessionStorage auth-key writes..."
if grep -rIE "localStorage\.setItem.*${AUTH_KEYS}|sessionStorage\.setItem.*${AUTH_KEYS}" "$TENANT" "$ADMIN" 2>/dev/null \
  | grep -v "/auth/" \
  | grep -v "/__tests__/" > /tmp/auth-lint-bad-localstorage.txt && [ -s /tmp/auth-lint-bad-localstorage.txt ]; then
  echo "  FAIL: banned localStorage/sessionStorage auth-key writes found:"
  cat /tmp/auth-lint-bad-localstorage.txt
  FAIL=1
fi

# ─── 2. No raw document.cookie write outside CookieTokenRepository ───────────
echo "[auth-lint] Checking raw document.cookie writes..."
if grep -rIE "document\.cookie\s*=" "$TENANT" "$ADMIN" 2>/dev/null \
  | grep -v "/auth/impl/CookieTokenRepository.ts" \
  | grep -v "/auth/__tests__/" \
  > /tmp/auth-lint-bad-cookies.txt && [ -s /tmp/auth-lint-bad-cookies.txt ]; then
  echo "  FAIL: raw document.cookie writes found (must go through ITokenRepository):"
  cat /tmp/auth-lint-bad-cookies.txt
  FAIL=1
fi

# ─── 3. No window.location.href = '/login' outside auth/useRequireAuth ──────
echo "[auth-lint] Checking hard-redirects to /login..."
if grep -rIE "window\.location\.href.*['\"]/?login" "$TENANT" "$ADMIN" 2>/dev/null \
  | grep -v "/auth/" \
  | grep -v "/__tests__/" > /tmp/auth-lint-bad-redirect.txt && [ -s /tmp/auth-lint-bad-redirect.txt ]; then
  echo "  FAIL: hard-redirects to /login found (must use useAuth().logout() or AuthService):"
  cat /tmp/auth-lint-bad-redirect.txt
  FAIL=1
fi

# ─── 4. No SecureStorageKey / setSecureToken outside auth/ (dead code) ───────
echo "[auth-lint] Checking SecureStorageKey/setSecureToken references..."
if grep -rIE "SecureStorageKey|setSecureToken|getSecureToken|clearAllSecureTokens" "$TENANT" "$ADMIN" 2>/dev/null \
  | grep -v "/auth/" > /tmp/auth-lint-bad-secure.txt && [ -s /tmp/auth-lint-bad-secure.txt ]; then
  echo "  FAIL: SecureStorageKey/dead-token helpers found (removed in FIX-020):"
  cat /tmp/auth-lint-bad-secure.txt
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "[auth-lint] OK — no banned patterns found."
  exit 0
fi
echo "[auth-lint] FAILED"
exit 1
