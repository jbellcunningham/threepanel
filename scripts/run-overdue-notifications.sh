#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"

if [[ -z "${CRON_SECRET}" ]]; then
  echo "CRON_SECRET is required"
  exit 1
fi

curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/overdue-todo-notifications"

echo
echo "Overdue todo notification job completed."
