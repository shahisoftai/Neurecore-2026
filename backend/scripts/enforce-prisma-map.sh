#!/usr/bin/env bash
# ─── scripts/enforce-prisma-map.sh ───────────────────────────────────────────
# D24: Enforce @@map() on every Prisma model to prevent table-name mismatches.
#
#   bash scripts/enforce-prisma-map.sh
#
# Exits 0 if all models have @@map(), exits 1 otherwise.
#
# Override: Create a file `prisma/.map-allowlist` with one model name per line
# to skip enforcement for legacy models that pre-date the @@map() convention.
# These models already have their tables correctly created in the DB
# (with PascalCase names) and renaming them would require a destructive
# production migration. New models MUST have @@map() with no override.

set -euo pipefail

SCHEMA="prisma/schema.prisma"
ALLOWLIST="prisma/.map-allowlist"

if [ ! -f "$SCHEMA" ]; then
  echo "[enforce-prisma-map] ERROR: $SCHEMA not found"
  exit 1
fi

echo "[enforce-prisma-map] Checking Prisma models for @@map()..."

MODELS=$(grep -E '^model [A-Z]' "$SCHEMA" | awk '{print $2}')

FAIL=0
WARN=0
ALLOWED=0

for MODEL in $MODELS; do
  START_LINE=$(grep -n "^model ${MODEL}" "$SCHEMA" | head -1 | cut -d: -f1)
  NEXT_MODEL_LINE=$(tail -n +$((START_LINE + 1)) "$SCHEMA" | grep -nE '^model [A-Z]' | head -1 | cut -d: -f1)
  if [ -n "$NEXT_MODEL_LINE" ]; then
    END_LINE=$((START_LINE + NEXT_MODEL_LINE - 1))
  else
    END_LINE=$(wc -l < "$SCHEMA")
  fi

  MODEL_BLOCK=$(sed -n "${START_LINE},${END_LINE}p" "$SCHEMA")

  if echo "$MODEL_BLOCK" | grep -q '@@map('; then
    echo "  ✓ ${MODEL} has @@map()"
  else
    # Check allowlist
    if [ -f "$ALLOWLIST" ] && grep -qx "${MODEL}" "$ALLOWLIST"; then
      echo "  ⚠ ${MODEL} missing @@map() — allowed by prisma/.map-allowlist (legacy)"
      WARN=1
      ALLOWED=$((ALLOWED + 1))
    else
      echo "  ✗ ${MODEL} MISSING @@map()"
      FAIL=1
    fi
  fi
done

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "[enforce-prisma-map] FAIL: Some models are missing @@map()"
  echo "Every Prisma model MUST have @@map('table_name') to ensure correct table name mapping."
  echo "If this is a legacy model, add it to prisma/.map-allowlist to allow."
  exit 1
fi

if [ "$WARN" -eq 1 ]; then
  echo ""
  echo "[enforce-prisma-map] OK with ${ALLOWED} allowlisted legacy model(s) — all new models compliant"
fi
exit 0
