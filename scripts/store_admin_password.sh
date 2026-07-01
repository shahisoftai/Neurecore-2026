#!/usr/bin/env bash
set -euo pipefail

# Usage: sudo ./scripts/store_admin_password.sh [/root/.admin_password]
# Or: echo "mypassword" | sudo ./scripts/store_admin_password.sh /root/.admin_password

DEST=${1:-/root/.admin_password}

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root to write to $DEST" >&2
  exit 1
fi

# Read password from stdin if provided, otherwise prompt interactively
if [ -t 0 ]; then
  read -s -p "Password: " PW
  echo
else
  PW=$(cat -)
fi

umask 077
printf '%s' "$PW" > "$DEST"
chmod 600 "$DEST"
chown root:root "$DEST"

echo "Password stored to $DEST with mode 600 and owned by root." 
