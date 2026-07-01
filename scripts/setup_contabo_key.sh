#!/usr/bin/env bash
set -euo pipefail

# Usage: bash scripts/setup_contabo_key.sh [host] [user] [passfile]
# Defaults: host=109.123.248.253 user=admin passfile=./contabo

HOST=${1:-109.123.248.253}
USER=${2:-admin}
PASSFILE=${3:-./contabo}
KEY=${4:-$HOME/.ssh/id_contabo}

if [ ! -f "$PASSFILE" ]; then
  echo "Password file not found: $PASSFILE" >&2
  exit 1
fi

PUBKEY="$KEY.pub"

if [ ! -f "$KEY" ]; then
  echo "Generating SSH key: $KEY"
  mkdir -p "$HOME/.ssh"
  ssh-keygen -t ed25519 -f "$KEY" -N "" -C "contabo" >/dev/null
else
  echo "Using existing key: $KEY"
fi

if command -v sshpass >/dev/null 2>&1; then
  echo "Using sshpass to copy key..."
  sshpass -f "$PASSFILE" ssh -o StrictHostKeyChecking=no "$USER@$HOST" "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys" < "$PUBKEY"
  echo "Public key appended to $USER@$HOST:~/.ssh/authorized_keys"
  exit 0
fi

if command -v expect >/dev/null 2>&1; then
  echo "Using expect to copy key..."
  PW=$(<"$PASSFILE")
  # Use expect to run ssh and feed the public key via stdin
  expect <<EOF
    set timeout -1
    spawn ssh -o StrictHostKeyChecking=no $USER@$HOST "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys"
    expect {
      -re \"(?i)password:\\s*\" {
        send -- "$PW\r"
        exp_continue
      }
      eof
    }
EOF
  echo "Public key appended to $USER@$HOST:~/.ssh/authorized_keys"
  exit 0
fi

echo "Neither sshpass nor expect is installed. Install one to allow non-interactive password-based key copy."
echo "Install on Debian/Ubuntu: sudo apt update && sudo apt install -y sshpass expect"
exit 2
