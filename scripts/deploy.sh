#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"

if [[ ! -f ".env" ]]; then
  echo "ERROR: .env file not found. Copy .env.example to .env first."
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building containers"
docker compose -f "${COMPOSE_FILE}" build

echo "==> Starting services"
docker compose -f "${COMPOSE_FILE}" up -d

echo "==> Running database migrations"
docker compose -f "${COMPOSE_FILE}" exec app npx prisma migrate deploy

echo "==> Service status"
docker compose -f "${COMPOSE_FILE}" ps

echo "Deploy complete."
