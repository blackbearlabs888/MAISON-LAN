# INSTALLATION — Fresh Install Guide

Time: ~5 minutes (SQLite, no database server needed).

## 0. Prerequisites

- **Node.js 20+** (npm) **or Bun 1.x** — everything (seed included) runs with plain Node; Bun is optional.
- Git (to clone).
- Outbound internet for the package install and Google Fonts (via `next/font` at build time).

## 1. Get the code

```bash
git clone <your-repository-url> maison-elan
cd maison-elan
```

## 2. Install dependencies

```bash
bun install        # or: npm install
```

> **npm 11.19+ users:** npm gates dependency install scripts behind an allowlist. This repository already ships an `allowScripts` map in `package.json` (Prisma CLI/client/engines, `@swc/core`, `@parcel/watcher`, `unrs-resolver`, `es5-ext`), so `npm install` runs everything it needs with **no action required**. You may still see a harmless warning about 2 packages (`deepmerge-ts`, `react-syntax-highlighter`) — their `prepare` scripts only run inside their own repos and are never executed on install. Only if you add a new dependency that ships an install script, approve it once: `npm install-scripts approve <pkg>`.

## 3. One-command setup (recommended)

```bash
npm run setup      # or: bun run setup
```

That single command runs, in order: generate the Prisma Client → create tables (`prisma db push`) → seed demo data (ensure mode) → print per-table row counts as proof. It **refuses to run** against a `postgres://` URL or on Vercel (remote provisioning belongs to the deploy build), so it is safe to run on any local machine.

Prefer doing it manually, or re-running steps later? See §4–5 below.

## 4. Manual path — configure the environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Default / example |
|---|---|---|
| `DATABASE_URL` | ✅ | `file:./db/custom.db` (SQLite file, created by step 5) |
| `APP_URL` | — | `http://localhost:3000` (set your public URL in production) |
| `TELEGRAM_BOT_TOKEN` | — | from @BotFather (see `docs/TELEGRAM-SETUP.md`) |
| `TELEGRAM_CHAT_ID` | — | your operator chat/group id |

The DB file resolves relative to the `prisma/` schema directory, so `file:./db/custom.db` creates `db/custom.db` in the project root (already the case in this repository).

## 5. Create the database schema

```bash
bun run db:push     # or: npm run db:push
```

This syncs `prisma/schema.prisma` to SQLite and creates `db/custom.db`. If you later edit the schema, re-run `db:push` (local SQLite dev) — PostgreSQL deployments use version-controlled migrations instead (`prisma/migrations/` + `bun run db:migrate:deploy`, applied automatically on every deploy — see `docs/DATABASE.md` §10).

## 6. Choose your account path

### Option A — Development/demo install: seed

```bash
bun run db:seed    # or: npm run db:seed (runs with plain Node — bun not required)
```

Idempotent seed (safe to re-run): settings singleton, 3 demo accounts, 5 categories, 14 products with variants/images, 2 banners, 3 couriers with rates, 7 CMS pages, FAQ entries.

> ⚠️ **Seeded credentials are DEV-ONLY and publicly documented** (owner@maisonelan.dev / Maison2025!, orders@maisonelan.dev / Staff2025!, customer@example.com / Customer2025!). Never seed a production store.

### Option B — Production install: owner bootstrap

Do **not** run the seed. Start the app and open:

```
http://localhost:3000/webmaster/setup
```

Available **only while zero OWNER accounts exist**. Create your single owner account (bcrypt-hashed, signed in immediately, recorded as `OWNER_BOOTSTRAP` in the audit log). The page disables itself forever after. Rate-limited to 5 attempts / 5 min per IP.

Additional staff accounts (ADMIN/ORDER_MANAGER/CONTENT_MANAGER) currently have **no UI** — create them directly in the database (Prisma Studio or SQL). Honest, documented procedure: `docs/WEBMASTER-GUIDE.md` § "Adding staff accounts".

## 7. Run

```bash
bun run dev            # development, http://localhost:3000 (logs → dev.log)
```

Production build & run:

```bash
bun run build          # standalone output in .next/standalone/
bun run start          # NODE_ENV=production, logs → server.log
```

Production deployment details (reverse proxy, HTTPS, migrations on the server): `docs/DEPLOYMENT.md`.

## 8. Verification checklist

Run through every item:

- [ ] `http://localhost:3000` loads the homepage: announcement bar, hero carousel (seed: "The Autumn Atelier"), category tiles, product rails.
- [ ] Catalog works: `/products` lists seeded products; filters/sort/search respond; `/collections/handbags` shows seeded handbags.
- [ ] A product page renders gallery, variant picker, stock, and "Add to cart"; the cart persists across reload.
- [ ] `http://localhost:3000/webmaster` redirects to login when anonymous.
- [ ] Login as the owner (seed: `owner@maisonelan.dev` / `Maison2025!`, or your bootstrap account) → `/webmaster` dashboard shows KPIs without errors.
- [ ] `/webmaster/settings` loads and saving a setting (e.g. toggle the announcement bar) reflects on the storefront immediately.
- [ ] Place a test order (checkout → bank-transfer instructions shown) → it appears in `/webmaster/orders`; `/track` finds it with order number + email.
- [ ] `bun run lint` exits clean.

## 9. Production notes

- **PostgreSQL** — a ready-made `prisma/schema.postgres.prisma` + `prisma/migrations/` ship with the repo; money is integer cents, so the switch is numerically safe. Point `DATABASE_URL`/`DIRECT_DATABASE_URL` at Postgres, run `bun run db:migrate:deploy` (or just deploy to Vercel — the build provisions the database, migrates, seeds and verifies automatically). Details: `README.md` § Switching SQLite → PostgreSQL and `docs/DEPLOYMENT-VERCEL.md`.
- **`NODE_ENV=production`** — set by `bun run start`; it flips the session cookie to `Secure` (HTTPS required) and hides the dev-only password-reset token.
- **HTTPS** — terminate TLS at a reverse proxy (Caddy/Nginx); the session cookie is `Secure` in production and plain-HTTP deployments will loop on login.
- **`APP_URL`** — set to the public URL so Telegram messages carry correct dashboard deep-links.
- **Backups** — schedule `db/custom.db` + `public/uploads/` backups before go-live: `docs/BACKUP-RESTORE.md`.
- **Telegram** — optional; configure env vars and verify with the test button: `docs/TELEGRAM-SETUP.md`.
