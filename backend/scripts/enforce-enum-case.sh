#!/usr/bin/env bash
# ─── scripts/enforce-enum-case.sh ───────────────────────────────────────────
# D25: Enforce enum case consistency — Prisma enum NAMES must be PascalCase.
#
# This script checks that all enum definitions in schema.prisma have
# PascalCase names (matching the Prisma/PostgreSQL convention).
#
# Note: Enum VALUES (the possible states) are not enforced to be
# SCREAMING_SNAKE_CASE since some enums (like SolutionPackStatus) use
# lowercase values intentionally (draft, beta, stable, deprecated).
#
# The key issue this catches is when enum NAMES in the schema don't match
# the database (e.g., snake_case enum type names vs PascalCase).
#
#   bash scripts/enforce-enum-case.sh
#
# Exits 0 if all enum names are PascalCase, exits 1 otherwise.

set -uo pipefail

SCHEMA="prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "[enforce-enum-case] ERROR: $SCHEMA not found"
  exit 1
fi

echo "[enforce-enum-case] Checking enum naming convention..."

FAIL=0

# Get all enum declarations
while IFS= read -r line; do
  ENUM_NAME=$(echo "$line" | awk '{print $2}')
  ENUM_LINE_NUM=$(echo "$line" | cut -d: -f1)

  # Check enum name is PascalCase
  # PascalCase: starts with uppercase, only letters and numbers after
  if ! echo "$ENUM_NAME" | grep -qE '^[A-Z][a-zA-Z0-9]*$'; then
    echo "  ✗ enum ${ENUM_NAME} (line ${ENUM_LINE_NUM}) is NOT PascalCase"
    echo "    Enum names must be PascalCase (e.g., UserRole, ApprovalStatus)"
    FAIL=1
  fi

done < <(grep -nE '^enum [A-Z]' "$SCHEMA")

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "[enforce-enum-case] FAIL: Some enum names are not PascalCase"
  echo "Enum names must be PascalCase to match Prisma/PostgreSQL conventions."
  echo "This ensures the enum type name in the database matches the schema."
  exit 1
fi

echo "[enforce-enum-case] OK — all enum names are PascalCase"
exit 0
