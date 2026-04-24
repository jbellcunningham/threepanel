# ThreePanel — Master Handoff Document

---

## 1. Purpose

This document is the living handoff for the ThreePanel application.

It defines:
- architecture and runtime model
- docker workflows (dev + production)
- Prisma runtime requirements
- auth/session behavior
- roles and container access model
- API and UI structure
- deployment and operational practices
- guardrails for future development

This is the primary reference for continuing development and operations.

---

## 2. System Overview

Single Ubuntu server hosts multiple dockerized web apps behind nginx.

ThreePanel:
- Next.js application
- PostgreSQL database
- Reverse proxied with HTTPS
- Running on host port `3000` (must remain unchanged due to multi-site setup)

---

## 3. Request Flow

```text
Internet
 -> UDM / DNS
 -> Nginx reverse proxy
 -> localhost:3000
 -> threepanel_app container (Next.js)
 -> threepanel_db container (PostgreSQL)
```

---

## 4. Paths and Ownership

Server user:
- `jcunningham`

Key paths:
- Compose root: `/opt/threepanel`
- App repo root: `/opt/threepanel/app/threepanel`
- Primary compose file: `/opt/threepanel/docker-compose.yml`
- Dev override compose: `/opt/threepanel/docker-compose.dev.yml`

Important:
- `/opt/threepanel` is not the git root
- run git commands from `/opt/threepanel/app/threepanel`

---

## 5. Docker Architecture

### Production mode

Compose:
- `/opt/threepanel/docker-compose.yml`

Behavior:
- uses image build flow (`next build`, `next start`)
- suited for stable deploys
- slower iteration due to image rebuilds

### Development mode (active preferred workflow)

Compose override:
- `/opt/threepanel/docker-compose.dev.yml`

Behavior:
- bind-mounted source code from `/opt/threepanel/app/threepanel`
- runs `next dev --hostname 0.0.0.0 --port 3000`
- hot reload for rapid edits
- keeps same port mapping (`3000`)

---

## 6. App Architecture

Framework:
- Next.js App Router

API routes:
- `/src/app/api/*`

Core app sections:
- `/login`
- `/app/containers`
- `/app/containers/[id]`
- container-type views for tracker, todos, journal, reporting

Data model style:
- schema-driven containers (dynamic JSON-backed fields)
- `TrackerItem` + `TrackerEntry` pattern
- per-container schema and entry payloads

---

## 7. Authentication and Authorization

Auth model:
- session cookie (`session`) persisted in database
- session validation through `getCurrentUser()`

Roles (Prisma enum):
- `USER`
- `ADMIN`
- `TESTER`
- `REPORTING`

Additional access model:
- `ContainerAccess` records user/container read grants

Current behavior:
- login/logout/me endpoints active
- admin endpoints available for user/access management

---

## 8. Prisma and Database (Critical)

Database:
- PostgreSQL in `threepanel_db`

Prisma:
- `@prisma/client`
- `@prisma/adapter-pg`
- `pg`

Runtime requirement:
- Prisma client must be generated and present in container runtime.

Known dev-mode failure mode:
- `.prisma/client/default` missing causes API `500` on auth and tracker routes.

Recovery pattern:
- recreate node_modules volume
- run `npm ci`
- run `npx prisma generate`
- restart dev stack

---

## 9. Operational Notes (Learned)

1) Disk pressure risk:
- build cache can consume very large space quickly
- `No space left on device` breaks both builds and file writes

2) Dev container dependency drift:
- `next: not found`, `pg` missing, prisma runtime missing can occur when node_modules volume is stale/broken

3) Build-time TS strictness:
- production builds enforce full type check and may surface previously hidden route typing issues

---

## 10. Deployment Workflow (Git-first)

Recommended flow:
1. Update code in git repo (`/opt/threepanel/app/threepanel`)
2. Commit and push to `origin/main`
3. Pull and deploy from server

Commands:
```bash
cd /opt/threepanel/app/threepanel
git pull --ff-only
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.yml up -d --build
docker compose -f /opt/threepanel/docker-compose.yml exec app npx prisma migrate deploy
docker compose -f /opt/threepanel/docker-compose.yml ps
```

---

## 11. Dev Service Auto-Start

Systemd unit:
- `/etc/systemd/system/threepanel-dev.service`

Expected state:
- `active (exited)` (oneshot service)

Management:
```bash
sudo systemctl daemon-reload
sudo systemctl enable threepanel-dev.service
sudo systemctl start threepanel-dev.service
sudo systemctl status --no-pager --full threepanel-dev.service
```

---

## 12. Monitoring and Health Checks

Core checks:
```bash
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml ps
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml logs --tail=120 app
curl -I http://127.0.0.1:3000
df -h
docker system df
```

Healthy indicators:
- app/db containers are `Up`
- HTTP response from localhost:3000
- login route returns `POST /api/auth/login 200`
- post-login auth calls return `GET /api/me 200`

---

## 13. Security and Constraints

- Keep HTTPS + nginx reverse proxy as front door
- Keep port `3000` unchanged for current site routing compatibility
- Keep secrets only in server-managed env files (never commit secrets)
- Use least-privilege principles for new admin/reporting features
- Validate input server-side for all API routes

---

## 14. Development Rules for Continuation

- One change set at a time; validate after each step.
- Prefer dev mode for fast iteration.
- Use production build only as checkpoint validation.
- Keep git operations in repo root (`/opt/threepanel/app/threepanel`).
- Avoid ad hoc edits in non-repo paths.
- Keep runbook updated whenever operational steps change.

---

## 15. Immediate Next Priorities

1. Stabilize and type-clean all route handlers currently using quick fixes.
2. Add dedicated production compose and deploy script flow to repo.
3. Add `.env.example` and deployment docs aligned to actual server layout.
4. Add backup routine and restore-tested process for PostgreSQL.
5. Add CI checks for lint/type/build before server deployment.

---

## 16. Golden Rule

Use git as source-of-truth, dev mode for speed, and explicit runbook steps for every operational action.

