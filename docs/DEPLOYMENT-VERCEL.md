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

```bash
bun run db:push:pg               # pushes prisma/schema.postgres.prisma to Neon
```

Success output ends with `Your database is now in sync with your schema.`

Optional demo data (⚠️ skip on a real store — it creates demo products and
`demo@maisonelan.dev / Demo2025!`):

```bash
bun run db:generate:pg && bun run db:seed
```

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
4. Two safety nets guarantee the correct Prisma Client on Vercel:
   - `vercel-build` script: `prisma generate --schema prisma/schema.postgres.prisma && next build`
   - `postinstall` script (`scripts/prisma-generate.cjs`): detects `VERCEL=1` and generates the **PostgreSQL** client — even if a custom Build Command bypasses `vercel-build`.

### 4.3 Environment variables

**Project → Settings → Environment Variables** (Production + Preview):

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** string (`…-pooler…`) | app runtime |
| `DIRECT_DATABASE_URL` | Neon **direct** string | schema ops |
| `APP_URL` | `https://<your-deployment>.vercel.app` — **no trailing slash** | Telegram deep-links, robots & sitemap. `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` are accepted as fallbacks if already set; update after adding a custom domain |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | *(optional)* | better: set in the web UI, `/webmaster/notifications` (stored in DB, wins over ENV) |

**Recommended:** Project → Settings → Functions → **Region** → pick the same
region as your Neon project (e.g. Singapore) — keeps DB round-trips at a few ms.

Click **Deploy**. First build takes ~2–3 min.

### 4.4 Custom domain (optional)

Project → Settings → Domains → add your domain, point DNS as instructed
(CNAME). Then update `APP_URL` to the custom domain and **redeploy**.

## 5. First run

1. Open `https://<your-domain>/webmaster/setup` — creates the single **OWNER**
   account (the page locks itself forever once an owner exists).
2. Sign in → you land on the Webmaster Console.
3. Configure the store under **Store settings** (brand, shipping, footer,
   socials, notifications).

> **Security:** if you seeded demo data, sign in as owner and
> deactivate/remove `demo@maisonelan.dev` under **Customers**. Seeded
> credentials are never production defaults.

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
| `P3006` / missing tables after deploy | `bun run db:push:pg` was never run against Neon — repeat §3. |
| Upload button in webmaster fails with 507 | Expected on Vercel — see §6 Media uploads. |
| 401 loops after login | Set `APP_URL` to the exact URL users browse (scheme + host), then redeploy. |

## 8. Updating the store after launch

```bash
git pull                         # after local changes are pushed
```

Schema changes during development: edit `prisma/schema.postgres.prisma`
(keep both schemas in sync — they differ only in the datasource block), then:

```bash
bun run db:push:pg && git push   # Vercel redeploys automatically on push
```
