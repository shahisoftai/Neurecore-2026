#!/usr/bin/env bash
# ─── scripts/lint-no-isuuid.sh ───────────────────────────────────────────────
# D26: Prevent @IsUUID() usage on CUID ID fields.
#
# NeureCore uses CUIDs (e.g. cm9p2x3ka0001abc...) for all primary keys,
# not RFC 4122 UUIDs. Using @IsUUID() blocks valid CUIDs at the validation
# layer. Use @IsString() instead for ID fields.
#
#   bash scripts/lint-no-isuuid.sh
#
# Exits 1 if any @IsUUID() usage is found outside the allowlist.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_SRC="$ROOT/backend/src"
ALLOWLIST="$ROOT/backend/scripts/.isuuid-allowlist"

FAIL=0
COUNT=0

echo "[lint-no-isuuid] Scanning for @IsUUID() usage..."

# Find all @IsUUID() usages (exclude comments and string literals)
# Match: line starts with optional whitespace + @IsUUID() (decorator usage)
MATCHES=$(grep -rnE '^\s*@IsUUID\(\)' "$BACKEND_SRC" --include='*.ts' 2>/dev/null || true)

if [ -z "$MATCHES" ]; then
  echo "  ✓ No @IsUUID() found — all ID fields use @IsString()"
  exit 0
fi

while IFS= read -r match; do
  if [ -z "$match" ]; then continue; fi
  FILE=$(echo "$match" | cut -d: -f1)
  LINE=$(echo "$match" | cut -d: -f2)
  # Check if file is in allowlist
  if [ -f "$ALLOWLIST" ] && grep -qxF "$FILE" "$ALLOWLIST"; then
    echo "  ⚠ $FILE:$LINE — allowed (in allowlist)"
  else
    echo "  ✗ $FILE:$LINE — @IsUUID() should be @IsString() for CUID IDs"
    FAIL=1
  fi
  COUNT=$((COUNT + 1))
done <<< "$MATCHES"

echo ""
if [ "$FAIL" -eq 1 ]; then
  echo "[lint-no-isuuid] FAIL: $COUNT @IsUUID() usage(s) found"
  echo "Replace @IsUUID() with @IsString() for CUID ID fields."
  echo "If a legitimate UUID field exists, add the file to scripts/.isuuid-allowlist."
  exit 1
fi

echo "[lint-no-isuuid] OK: $COUNT @IsUUID() usage(s) all allowed"
exit 0
