#!/usr/bin/env bash
# Helper to start local Postgres + Redis using Docker or Podman
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if command -v docker >/dev/null 2>&1; then
  echo "Using docker to start compose services..."
  docker compose up -d
  exit 0
fi

if command -v podman >/dev/null 2>&1; then
  echo "Using podman to start compose services..."
  podman compose up -d
  exit 0
fi

cat <<'EOF'
Neither `docker` nor `podman` were found on this system.
Please install Docker (https://docs.docker.com/engine/install/) or Podman
and re-run this script. On Ubuntu you can run:

  sudo apt update
  sudo apt install -y docker.io docker-compose-plugin

After installing, re-run:

  ./scripts/start-local-prod.sh

EOF
exit 2
