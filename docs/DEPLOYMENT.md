# DEPLOYMENT — Production Deployment Guide

> **Deploying to Vercel with a Neon PostgreSQL database?** Follow the dedicated
> step-by-step guide instead: **`docs/DEPLOYMENT-VERCEL.md`** (~15 min, includes
> schema push, env vars, `vercel-build`, and Vercel-specific caveats).
> This guide covers self-hosted VPS/Docker with SQLite.

The app builds to a **standalone Node server** (`output: "standalone"` in `next.config.ts` — disabled automatically on Vercel), so any Linux box or managed platform that runs Node 20+/Bun works. SQLite needs a persistent filesystem; for managed/serverless platforms with ephemeral disks, switch to PostgreSQL first (see `README.md` § Switching SQLite → PostgreSQL or `prisma/schema.postgres.prisma`).

## 1. Environment checklist

| Item | Value |
|---|---|
| `DATABASE_URL` | `file:./db/custom.db` (SQLite — file must live on persistent storage) or PostgreSQL URL |
| `APP_URL` | **Public** URL, e.g. `https://shop.example.com` — used in Telegram deep-links |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Optional ENV fallback. **Preferred:** configure in the web UI at `/webmaster/notifications` — values are stored in the DATABASE and win over ENV (no redeploy needed) |
| `SESSION_COOKIE_SAMESITE` | Leave unset for automatic (`production` → `None`). Set `none` only when embedding the store in a cross-site iframe |
| `NODE_ENV` | `production` — set automatically by `bun run start`; flips the session cookie to `Secure` (HTTPS required) and hides the dev-only reset token |

Secrets belong only in the environment — never in the DB, never in git.

## 2. Build & run (VPS)

### From the release ZIP (no git needed)

```bash
unzip maison-elan-deploy.zip -d maison-elan && cd maison-elan
bun install                 # or: npm install / pnpm install
cp .env.example .env        # then edit: DATABASE_URL, APP_URL, optional Telegram
bun run db:push             # create the SQLite schema (file: ./db/custom.db)
bun run build && bun run start
```

> The ZIP contains source only (no `node_modules`, no `.next`, no database) — the
> store data stays out of the artifact, which is exactly what you want for a clean deploy.

### From git

```bash
# on the server
git clone <repo> && cd maison-elan
bun install
cp .env.example .env    # then edit: DATABASE_URL, APP_URL, optional Telegram

# schema
bun run db:push         # or, with a migration history: bun run db:migrate (then prisma migrate deploy)

# production owner — DO NOT seed a real store
bun run build
bun run start           # NODE_ENV=production bun .next/standalone/server.js (logs → server.log)
```

First run: open `https://your-domain/webmaster/setup` to create the single OWNER account (works only while no owner exists). Verify with the checklist in `docs/INSTALLATION.md` § 7.

> The `build` script copies `.next/static` and `public/` into `.next/standalone/` (per `package.json`), so the standalone folder is self-contained. Note that `public/uploads/` is copied at **build time** — run the build before staff upload files, or keep `public/` on a persistent volume shared into the standalone directory (see § 7 Media).

Run it under a process manager:

```ini
# /etc/systemd/system/maison-elan.service
[Service]
WorkingDirectory=/opt/maison-elan
ExecStart=/usr/local/bin/bun .next/standalone/server.js
Environment=NODE_ENV=production
Environment=PORT=3000
Restart=always
User=maison
[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now maison-elan
```

## 3. Reverse proxy + HTTPS

The session cookie is `Secure` in production — **HTTPS is mandatory**. Terminate TLS at the proxy and forward to `localhost:3000`:

**Caddy** (automatic certificates) — a `Caddyfile` exists in the repo root for the sandbox on `:81`; for production use your domain:

```caddy
shop.example.com {
    reverse_proxy localhost:3000
}
```

**Nginx**:

```nginx
server {
    listen 443 ssl http2;
    server_name shop.example.com;
    # ssl_certificate ...;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 10m;   # uploads are capped at 5 MB by the app
    }
}
```

The rate limiter keys on `clientIp()` from proxy headers (`src/lib/api-helpers.ts`), so correct `X-Forwarded-For` forwarding also keeps rate limiting accurate.

## 4. Database migrations in production

- Preferred: keep a migration history. During development use `bun run db:migrate` (`prisma migrate dev`) to generate SQL under `prisma/migrations/`; on the server apply non-interactively with:

  ```bash
  bunx prisma migrate deploy
  ```

- Simpler single-box installs may use `bun run db:push` (schema sync, `--accept-data-loss`) — always **back up the DB file first** (§ 6) because data-loss operations can drop columns/tables.

## 5. Managed platforms

- **Any Node host (Railway, Fly.io, Render, VPS)**: set env vars, `bun install && bun run build`, start command `bun .next/standalone/server.js` (or `bun run start`). Attach a persistent volume for SQLite + uploads, or use PostgreSQL.
- **Serverless (Vercel etc.)**: not suitable with SQLite (no persistent FS, no long-lived in-memory rate limiter). Switch to PostgreSQL and swap the rate-limit Map for Redis behind the same interface (`src/lib/rate-limit.ts`) before considering it.

## 6. Backups before deploy

Take a backup before every deploy that touches the schema:

```bash
sqlite3 db/custom.db ".backup '/backups/custom-$(date +%F-%H%M).db'"
tar czf /backups/uploads-$(date +%F-%H%M).tgz public/uploads
```

Full procedures, cron examples and restore drills: `docs/BACKUP-RESTORE.md`.

## 7. Health checks & media persistence

- **Health check**: `GET /` should render HTTP 200 (staff-gated `/webmaster` returns a redirect when anonymous — a fine secondary check). For TCP-level checks, probe port 3000.
- **Media**: uploads live in `public/uploads/`. Either rebuild before go-live so `public/` is baked into the standalone bundle and then treat `public/uploads` as persistent state, or symlink/volume-mount a persistent directory at `.next/standalone/public/uploads`. Back it up with the DB (they reference each other).
- **Log rotation**: dev/start scripts tee to `dev.log`/`server.log`. Rotate with logrotate:

  ```
  # /etc/logrotate.d/maison-elan
  /opt/maison-elan/server.log {
      weekly
      rotate 8
      compress
      missingok
      notifempty
      copytruncate
  }
  ```

  Under systemd, alternatively send stdout to journald and let `journald` rotate.

## 8. Go-live checklist

See `docs/RELEASE-CHECKLIST.md` for the full gate list (lint, fresh-clone install, seed/bootstrap policy, golden-path test, Telegram on-or-off decision, backups tested, docs match, version bumped).
