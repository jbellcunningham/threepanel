#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_FILE="${BACKUP_DIR}/threepanel_${TIMESTAMP}.sql.gz"

if [[ ! -f ".env" ]]; then
  echo "ERROR: .env file not found. Copy .env.example to .env first."
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "==> Creating backup at ${OUTPUT_FILE}"
docker compose -f "${COMPOSE_FILE}" exec -T db sh -c \
  "PGPASSWORD='${POSTGRES_PASSWORD}' pg_dump -U '${POSTGRES_USER}' -d '${POSTGRES_DB}'" \
  | gzip > "${OUTPUT_FILE}"

echo "Backup complete: ${OUTPUT_FILE}"
