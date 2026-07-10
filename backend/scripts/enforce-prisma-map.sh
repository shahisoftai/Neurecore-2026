#!/usr/bin/env bash
# ─── scripts/enforce-prisma-map.sh ───────────────────────────────────────────
# D24: Enforce @@map() on every Prisma model to prevent table-name mismatches.
#
#   bash scripts/enforce-prisma-map.sh
#
# Exits 0 if all models have @@map(), exits 1 otherwise.

set -euo pipefail

SCHEMA="prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "[enforce-prisma-map] ERROR: $SCHEMA not found"
  exit 1
fi

echo "[enforce-prisma-map] Checking Prisma models for @@map()..."

# Find all model blocks and check each has a @@map
# A model has @@map if there's a closing line before the next model or EOF
# that contains @@map(

# Get all model names
MODELS=$(grep -E '^model [A-Z]' "$SCHEMA" | awk '{print $2}')

FAIL=0

for MODEL in $MODELS; do
  # Check if this model has @@map
  # Extract content between this model and the next (or EOF)
  START_LINE=$(grep -n "^model ${MODEL}" "$SCHEMA" | head -1 | cut -d: -f1)

  # Find the next model line after this one
  NEXT_MODEL_LINE=$(tail -n +$((START_LINE + 1)) "$SCHEMA" | grep -nE '^model [A-Z]' | head -1 | cut -d: -f1)
  if [ -n "$NEXT_MODEL_LINE" ]; then
    END_LINE=$((START_LINE + NEXT_MODEL_LINE - 1))
  else
    END_LINE=$(wc -l < "$SCHEMA")
  fi

  # Extract model block and check for @@map
  MODEL_BLOCK=$(sed -n "${START_LINE},${END_LINE}p" "$SCHEMA")

  if echo "$MODEL_BLOCK" | grep -q '@@map('; then
    echo "  ✓ ${MODEL} has @@map()"
  else
    echo "  ✗ ${MODEL} MISSING @@map()"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "[enforce-prisma-map] FAIL: Some models are missing @@map()"
  echo "Every Prisma model MUST have @@map('table_name') to ensure correct table name mapping."
  exit 1
fi

echo "[enforce-prisma-map] OK — all models have @@map()"
exit 0
