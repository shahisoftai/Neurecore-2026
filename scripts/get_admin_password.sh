#!/usr/bin/env bash
set -euo pipefail

# Usage: sudo ./scripts/get_admin_password.sh [/root/.admin_password]

DEST=${1:-/root/.admin_password}

if [ ! -f "$DEST" ]; then
  echo "Secret file not found: $DEST" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Warning: reading $DEST may require root privileges." >&2
fi

cat "$DEST"
