# ThreePanel Runbook

Operational runbook for day-to-day management of ThreePanel on Ubuntu.

Server/user assumptions:
- Host: `es1-server`
- User: `jcunningham`
- Compose root: `/opt/threepanel`
- App repo root: `/opt/threepanel/app/threepanel`

---

## 1) Quick Status Check

```bash
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml ps
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml logs --tail=80 app
curl -I http://127.0.0.1:3000
df -h
docker system df
```

Healthy indicators:
- `threepanel_app` is `Up`
- `curl` returns HTTP response (200/302/307)
- Disk has free space (avoid >90%)

---

## 2) Start Dev Mode

```bash
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml up -d --build
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml logs -f app
```

Notes:
- Dev mode uses bind-mounted source from `/opt/threepanel/app/threepanel`
- App remains on port `3000` to match existing nginx routing

---

## 3) Start Production Mode

```bash
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.dev.yml down
docker compose -f /opt/threepanel/docker-compose.yml up -d --build
docker compose -f /opt/threepanel/docker-compose.yml exec app npx prisma migrate deploy
docker compose -f /opt/threepanel/docker-compose.yml ps
```

---

## 4) Restart Services

Dev stack:
```bash
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml restart app db
```

Prod stack:
```bash
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.yml restart app db
```

---

## 5) Common Failure: `502 Bad Gateway`

Check app container and logs:
```bash
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml ps
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml logs --tail=120 app
```

Check nginx:
```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
```

---

## 6) Common Failure: Prisma client missing in dev

Typical errors:
- `Cannot find module '.prisma/client/default'`
- API routes return `500` (`/api/me`, `/api/auth/login`, `/api/tracker`)

Fix sequence:
```bash
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml down
docker volume rm threepanel_threepanel_node_modules || true
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml up -d db
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml run --rm --entrypoint sh app -lc "npm ci && npx prisma generate"
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml up -d
docker compose -f /opt/threepanel/docker-compose.yml -f /opt/threepanel/docker-compose.dev.yml logs --tail=120 app
```

---

## 7) Common Failure: Disk Full (`No space left on device`)

```bash
df -h
docker system df
docker container prune -f
docker image prune -f
docker builder prune -af
find /opt/threepanel/app/threepanel -name "*.bak.*" -type f -delete
df -h
docker system df
```

If still critically full:
```bash
docker system prune -af --volumes
```

---

## 8) Git Workflow

```bash
cd /opt/threepanel/app/threepanel
git status
git pull --ff-only
git add -A
git commit -m "descriptive message"
git push origin main
```

If push fails:
- Use valid GitHub PAT for HTTPS remote, or
- switch to SSH remote auth

---

## 9) Deploy Workflow (from Git)

```bash
cd /opt/threepanel/app/threepanel
git pull --ff-only
cd /opt/threepanel
docker compose -f /opt/threepanel/docker-compose.yml up -d --build
docker compose -f /opt/threepanel/docker-compose.yml exec app npx prisma migrate deploy
docker compose -f /opt/threepanel/docker-compose.yml ps
```

---

## 10) Service Auto-Start (Dev)

Service:
- `/etc/systemd/system/threepanel-dev.service`

Commands:
```bash
sudo systemctl daemon-reload
sudo systemctl enable threepanel-dev.service
sudo systemctl start threepanel-dev.service
sudo systemctl status --no-pager --full threepanel-dev.service
```

Expected: `Active: active (exited)` for oneshot service.

---

## 11) Validate Login Flow

When testing auth:
- `POST /api/auth/login` should return `200`
- `GET /api/me` should return `200` after login
- `GET /api/me` returning `401` before login is expected

---

## 12) TLS / SSL Certificate

ThreePanel is served over HTTPS at **`app.es1creative.com`** (nginx site file
`threepanel`). The certificate **auto-renews** via
[`acme.sh`](https://github.com/acmesh-official/acme.sh); cert tasks run as
**root** (`sudo -i`).

> Full architecture (shared automation hub, Cloudflare token, add-a-domain
> recipe) is documented in the **BrownTroutSystems** repo `RUNBOOK.md`. This is
> the ThreePanel-specific summary.

### How it works

- `app.es1creative.com` is covered by the **`es1creative.com`** certificate
  (SAN: `es1creative.com`, `www.es1creative.com`, `app.es1creative.com`).
- `es1creative.com` is the **automation hub**: its DNS is on **Cloudflare**, so
  acme.sh validates DNS-01 **directly** through the Cloudflare API
  (`dns_cf`) — no CNAME delegation needed for this domain.
- Cert installed at `/etc/acme-certs/es1creative/{fullchain.pem,privkey.pem}`,
  referenced by the nginx `threepanel` site (and the `es1creative` apex/www
  parking site). acme.sh reloads nginx on renewal.

### Check / force renew (on `es1-server`)

```bash
sudo -i
~/.acme.sh/acme.sh --list                                # renewal dates
~/.acme.sh/acme.sh --renew -d es1creative.com --ecc --force   # renews all 3 SANs
```

Note: because the cert's main domain is `es1creative.com`, renew/verify against
that name (not `app.es1creative.com`).

### Verify the served cert

```bash
echo | openssl s_client -servername app.es1creative.com \
  -connect app.es1creative.com:443 2>/dev/null | openssl x509 -noout -enddate
```

### Ports / routing note

The app listens on `3000` behind nginx (see §1). nginx terminates TLS using the
cert above and proxies to the app — keep that mapping when editing configs.

