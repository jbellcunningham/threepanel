#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/threepanel/app/threepanel"
COMPOSE_BASE="/opt/threepanel/docker-compose.yml"
COMPOSE_DEV="/opt/threepanel/docker-compose.dev.yml"

echo "==> Pull latest code"
cd "${REPO_DIR}"
git pull --ff-only

echo "==> Run Prisma migrations"
cd /opt/threepanel
docker compose -f "${COMPOSE_BASE}" -f "${COMPOSE_DEV}" exec -T app npx prisma migrate deploy

echo "==> Regenerate Prisma client"
docker compose -f "${COMPOSE_BASE}" -f "${COMPOSE_DEV}" exec -T app npx prisma generate

echo "==> Restart app"
docker compose -f "${COMPOSE_BASE}" -f "${COMPOSE_DEV}" restart app

echo "==> Deployment complete"
