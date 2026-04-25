# ThreePanel

ThreePanel is a Next.js + Prisma + PostgreSQL personal tracking system.

## Local Development

1. Install dependencies:
   - `npm ci`
2. Create env file:
   - copy `.env.example` to `.env`
3. Set your database connection (`DATABASE_URL`)
4. Run migrations:
   - `npx prisma migrate deploy`
5. Start dev server:
   - `npm run dev`

## Production Deployment (Docker Compose)

This repository includes:
- `docker-compose.prod.yml` - app + postgres services
- `.env.example` - required environment variables
- `scripts/deploy.sh` - pull/build/migrate/restart flow
- `scripts/backup-db.sh` - database backup helper

### 1) Server Prerequisites

- Ubuntu server with Docker and Docker Compose plugin installed
- Reverse proxy (nginx/traefik) routing HTTPS traffic to port `3000`
- Repo cloned on server, for example:
  - `/opt/threepanel`

### 2) Initial Server Setup

1. Clone repository to server:
   - `git clone https://github.com/jbellcunningham/threepanel.git /opt/threepanel`
2. Enter repo:
   - `cd /opt/threepanel`
3. Create env file:
   - `cp .env.example .env`
4. Edit `.env` with strong secrets and production values.
5. Make scripts executable:
   - `chmod +x scripts/deploy.sh scripts/backup-db.sh`
6. Start services:
   - `docker compose -f docker-compose.prod.yml up -d --build`
7. Run migrations:
   - `docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy`

### 3) Ongoing Deploys

From `/opt/threepanel`:

1. Optional pre-deploy backup:
   - `./scripts/backup-db.sh`
2. Deploy latest code:
   - `./scripts/deploy.sh`

The deploy script performs:
- `git pull --ff-only`
- image rebuild
- app/db restart
- `prisma migrate deploy`
- service status check

## Backup Strategy

- Database backups are written to `./backups` by `scripts/backup-db.sh`.
- Recommended:
  - run backup before any migration
  - copy backups to off-server storage on a schedule

## Notes

- Keep `.env` only on the server (never commit real secrets).
- `DATABASE_URL` should point at the compose postgres service (`db`) in production.
- Use feature branches and PRs for changes; deploy from merged `main`.
