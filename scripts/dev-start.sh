#!/usr/bin/env bash
set -euo pipefail

# dev-start.sh — kill duplicate dev processes in this workspace and start backend + frontends
# Usage: ./scripts/dev-start.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Workspace root: $ROOT"

# Find and kill node processes running dev servers inside workspace (next dev / nest start --watch)
echo "Looking for duplicate dev processes..."
pids=$(ps aux | grep node | grep "$ROOT" || true)
if [ -n "$pids" ]; then
  echo "$pids"
  echo "Killing node dev processes in workspace..."
  # Extract PIDs and kill gracefully
  echo "$pids" | awk '{print $2}' | xargs -r kill -9 || true
else
  echo "No workspace node dev processes found."
fi

echo "Starting backend and frontends in background..."
cd "$ROOT"

# Start backend
echo "Starting backend (pnpm --filter backend run start:dev)"
(cd backend && pnpm run start:dev) &

sleep 1

echo "Starting frontend-tenant (3001)"
(cd frontend-tenant && pnpm run dev) &

sleep 1

echo "Starting frontend-admin (3002)"
(cd frontend-admin && pnpm run dev) &

echo "All started (processes run in background). Use 'ps aux | grep next\|nest' to inspect."
