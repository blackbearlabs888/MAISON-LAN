# Deploy MAISON ÉLAN to Vercel + Neon

Step-by-step production installation: **Neon** (serverless PostgreSQL) for data,
**Vercel** for hosting. Total time ≈ 15 minutes.

> Self-hosting on a VPS with SQLite? Use `docs/DEPLOYMENT.md` instead — the two
> guides are independent. The app ships **both** Prisma schemas:
> `prisma/schema.prisma` (SQLite, local/dev/VPS) and
> `prisma/schema.postgres.prisma` (PostgreSQL/Neon, this guide).

---

## 1. Create the Neon database

1. Sign up at [neon.tech](https://neon.tech) → **Create project**.
2. Name it (e.g. `maison-elan`), pick the region closest to your users
   (e.g. *Singapore* for Indonesia). Remember this region — see §4.3.
3. Open **Connection Details** and copy **both** strings:
   - **Pooled** (host contains `-pooler`) → this is `DATABASE_URL`
   - **Direct / unpooled** → this is `DIRECT_DATABASE_URL`
4. Suggested database name: `maisonelan`.

They look like:

```text
DATABASE_URL        = postgresql://USER:PASS@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/maisonelan?sslmode=require
DIRECT_DATABASE_URL = postgresql://USER:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/maisonelan?sslmode=require
```

> **Why two?** App runtime uses Neon's connection pooler (serverless-safe);
> schema operations (`db push` / `migrate`) must go through the direct string.
> This is the official Neon × Prisma setup via `directUrl`.

## 2. Prepare the code

```bash
unzip maison-elan-deploy.zip -d maison-elan && cd maison-elan
bun install                      # or npm install / pnpm install

cp .env.example .env
```

Edit `.env` — set the two Neon strings (§1), plus `APP_URL` (your final
production URL, e.g. `https://maisonelan.vercel.app` — you can update it after
§3.4 when the domain is known).

## 3. Create the schema on Neon

> **Since v0.2.2 this step is optional on a fresh deploy** — the Vercel build
> itself syncs the schema and seeds an empty database before building (§4.2).
> Run it manually if you want to verify the connection first, or whenever the
> build log reports a schema error.

```bash
bun run db:push:pg               # pushes prisma/schema.postgres.prisma to Neon
```

Success output ends with `Your database is now in sync with your schema.`

Optional demo data (⚠️ dev-only: creates 14 demo products, banners, couriers,
CMS pages, FAQ and these accounts — **`owner@maisonelan.dev / Maison2025!`
with the OWNER role**, `orders@maisonelan.dev / Staff2025!`,
`customer@example.com / Customer2025!`):

```bash
bun run db:generate:pg && bun run db:seed:pg
```

> Running `db:generate:pg` swaps your local Prisma Client to PostgreSQL — run
> `bun run db:generate` afterwards to restore the SQLite client for local dev.

Verify in the Neon console → **Tables**: you should see all 25 tables
(`User`, `Product`, `Order`, `WishlistItem`, …).

## 4. Deploy to Vercel

### 4.1 Push the code to GitHub

```bash
git init && git add . && git commit -m "MAISON ÉLAN — initial release"
git remote add origin https://github.com/<you>/maison-elan.git
git push -u origin main
```

### 4.2 Import into Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import the repo.
2. Framework preset is auto-detected (**Next.js**). Node.js default (20/22) is fine.
3. **Leave the Build Command field EMPTY** (do not type `next build` into it).
4. Three safety nets run automatically during the build:
   - `vercel-build` script: `prisma generate` (PostgreSQL client) → `scripts/prisma-deploy-db.cjs` (**pushes the schema to Neon + seeds demo content only if the database is empty**) → `next build`
   - `postinstall` script (`scripts/prisma-generate.cjs`): detects `VERCEL=1` and generates the **PostgreSQL** client — even if a custom Build Command bypasses `vercel-build`
   - Seed guard (`prisma/seed.ts`): seeds **only an empty database** — a redeploy never overwrites your users, products or admin-edited content

### 4.3 Environment variables

**Project → Settings → Environment Variables** (Production + Preview):

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** string (`…-pooler…`) | app runtime — the build also uses it to push the schema & seed |
| `DIRECT_DATABASE_URL` | Neon **direct** string | schema ops — if omitted, the build falls back to the pooled `DATABASE_URL` automatically |
| `APP_URL` | `https://<your-deployment>.vercel.app` — **no trailing slash** | Telegram deep-links, robots & sitemap. `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` are accepted as fallbacks if already set; update after adding a custom domain |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | *(optional)* | better: set in the web UI, `/webmaster/notifications` (stored in DB, wins over ENV) |

**Recommended:** Project → Settings → Functions → **Region** → pick the same
region as your Neon project (e.g. Singapore) — keeps DB round-trips at a few ms.

Click **Deploy**. First build takes ~2–3 min.

### 4.4 Custom domain (optional)

Project → Settings → Domains → add your domain, point DNS as instructed
(CNAME). Then update `APP_URL` to the custom domain and **redeploy**.

## 5. First run

**A. Database was auto-seeded** (build log shows `[prisma-deploy-db] … Seed complete`):

1. Sign in at `/login` with `owner@maisonelan.dev` / `Maison2025!`.
2. **Change the password immediately** (Account → Change password) — seeded
   credentials are documented and publicly known.
3. Review the demo catalog, then adjust or remove what you don't need.

**B. Database is empty** (no seed — you skipped it or the DB already had users):

1. Open `https://<your-domain>/webmaster/setup` — creates the single **OWNER**
   account (the page locks itself forever once an owner exists).
2. Sign in → you land on the Webmaster Console.
3. Configure the store under **Store settings** (brand, shipping, footer,
   socials, notifications).

> **Security:** never keep documented passwords in production. Change the
> seeded owner password (case A) and deactivate unused demo accounts
> (`orders@…`, `customer@…`) under **Customers**.

## 6. Vercel-specific behavior (important)

| Topic | Behavior on Vercel |
|---|---|
| **Media uploads** | The server filesystem is **read-only** — the upload API (`/api/upload`) detects this and returns a clear error (507). Upload images to [Vercel Blob](https://vercel.com/docs/storage/vercel-blob), S3 or Cloudinary and paste the **absolute URL** into the image fields — every image field accepts full URLs. Images already in `public/` ship with the build. |
| **SQLite** | Not available on Vercel (ephemeral disk) — that is why this guide uses Neon. |
| **Sessions** | Stored in the database (`Session` table) — works on serverless out of the box. |
| **Cron / background jobs** | None required; notifications are sent inline on order events. |
| **`NODE_ENV`** | Set to `production` by Vercel automatically — session cookies become `Secure`. |

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| **`Error validating datasource \`db\`: the URL must start with the protocol \`file:\``** (500 on every page, digest in the corner) | The deployment contains a **SQLite** Prisma Client while `DATABASE_URL` is a `postgresql://` string. Causes: an older release ZIP without Vercel support, or a Build Command override of `next build` that skipped the generate step. Fix: deploy the **latest ZIP**, make sure `scripts/` and `package.json` scripts are intact, **clear the Build Command field** (or set it to `bun run vercel-build`), then **Redeploy with Build Cache OFF** (Deployments → ⋯ → Redeploy). The build log must show `[prisma-generate] Generating Prisma Client from prisma/schema.postgres.prisma …`. |
| The reverse: `the URL must start with the protocol \`postgresql:\`` | A PostgreSQL client is running against a SQLite URL — you set a `postgres` URL somewhere while deploying the SQLite flow. Follow one guide only, don't mix. |
| `P1001: Can't reach the database server` | You used the direct string at runtime, or dropped `?sslmode=require`. Runtime must use the **pooled** URL. |
| `Environment variable not found: DIRECT_DATABASE_URL` | Set it in `.env` (local CLI) or Vercel env vars (build). |
| Error: *client generated for sqlite* / `sqlite does not support…` at runtime | The Postgres client wasn't generated — run `bun run db:generate:pg` locally, and confirm the `vercel-build` script wasn't removed in `package.json`. |
| `P3006` / missing tables after deploy | The build-time `prisma db push` failed — open **Deployments → Build Logs** and search `[prisma-deploy-db]`. Usually a wrong/unreachable `DATABASE_URL`, or a destructive schema change (see §8). |
| **Deploy succeeded but the store is empty / seed "tidak muncul"** | Check the build log for the `[prisma-deploy-db]` steps. `Seed skipped` → the database already has users, so the guard protected your data (by design). Want demo data anyway: set env `SEED_FORCE=1`, redeploy, remove the variable afterwards. `Seed FAILED` → run `bun run db:generate:pg && bun run db:seed:pg` locally against `.env` with the Neon strings. |
| Build fails with `[prisma-deploy-db] Schema push FAILED` | `DATABASE_URL`/`DIRECT_DATABASE_URL` wrong or unreachable from Vercel, or the schema change needs data loss (§8). The previous deployment stays live — fix the env/schema and redeploy. |
| Upload button in webmaster fails with 507 | Expected on Vercel — see §6 Media uploads. |
| 401 loops after login | Set `APP_URL` to the exact URL users browse (scheme + host), then redeploy. |
| **`Invalid email or password` for every password** | The `User.passwordHash` in Neon is not a real bcrypt hash (valid = exactly 60 chars, random `./A-Za-z0-9` — no repeating patterns, e.g. `…FYMq`, never `V5V5V5…`). Happens when a user row was inserted manually with a placeholder hash. Fix: `bun run hash:password "NewPassword123!"` → paste the printed hash into `UPDATE "User" SET "passwordHash" = '<hash>' WHERE email = '…';` (Neon SQL Editor) — or delete the row and use `/webmaster/setup`. See `docs/TROUBLESHOOTING.md`. |

## 8. Updating the store after launch

```bash
git pull                         # after local changes are pushed
```

Schema changes during development: edit `prisma/schema.postgres.prisma`
(keep both schemas in sync — they differ only in the datasource block), then
just `git push`. Every deploy runs `prisma db push` automatically, so **new
tables and columns are applied during the build** — no manual step needed.

Destructive changes (dropping columns, changing types) make the build fail on
purpose — apply them manually once, with the direct string in `.env`:

```bash
bun run db:push:pg               # add --accept-data-loss consciously
```
