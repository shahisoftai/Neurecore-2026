#!/usr/bin/env bash
set -euo pipefail

# Quick connect to Contabo using a password file (default /root/contabo).
# Usage: sudo bash scripts/connect_contabo.sh [host] [user] [passfile] [port]
# Defaults: host=109.123.248.253 user=admin passfile=/root/contabo port=22

HOST=${1:-109.123.248.253}
USER=${2:-admin}
PASSFILE=${3:-/root/contabo}
SSH_PORT=${4:-22}

if [ ! -f "$PASSFILE" ]; then
  echo "Password file not found: $PASSFILE" >&2
  exit 1
fi

# Prefer sshpass reading from file (safer than -p on the command line)
if command -v sshpass >/dev/null 2>&1; then
  sshpass -f "$PASSFILE" ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no "$USER@$HOST"
  exit $?
fi

# Fallback: use expect if available
if command -v expect >/dev/null 2>&1; then
  PW=$(<"$PASSFILE")
  expect -c \
    "set timeout -1; spawn ssh -p $SSH_PORT -o StrictHostKeyChecking=no $USER@$HOST;\
     expect { -re \"[Pp]assword:\\s*\" { send \"$PW\\r\"; interact } eof { exit } }"
  exit $?
fi

echo "Neither 'sshpass' nor 'expect' is installed. Install one to enable non-interactive password login." >&2
echo "Manual: ssh -p $SSH_PORT $USER@$HOST" >&2
exit 2
