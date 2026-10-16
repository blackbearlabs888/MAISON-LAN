# TROUBLESHOOTING

Common issues, verified against this build's actual behavior.

## Port 3000 busy

`bun run dev` pins port 3000 (`next dev -p 3000` — see `package.json`).

```bash
lsof -i :3000            # find the process
kill <pid>               # or change the port in package.json's dev script
```

A previous `dev.log`/`server.log` tee may keep a zombie process alive — kill the parent shell too. The Telegram fallback URLs assume port 3000 only for local dev; set `APP_URL` in production.

## Database locked (`SQLITE_BUSY`)

SQLite allows a single writer. Long transactions + concurrent writes (e.g. checkout during a webmaster save) can surface `database is locked`.

- Retry the operation; the checkout path wraps stock-deduction in one short transaction by design.
- Keep only **one** server process per SQLite file (never run two `next dev` instances against the same DB, and don't run `db:push` while the server is writing).
- If write contention is routine for your traffic, move to PostgreSQL (one-line datasource switch — `README.md`).

## Prisma client out of date (`Property … does not exist` / stale types)

Happens after editing `prisma/schema.prisma` or switching branches:

```bash
bun run db:generate      # regenerate the client
bun run db:push          # then align the database itself (dev)
```

## npm warns `install scripts not yet covered by allowScripts` (npm 11.19+)

Newer npm blocks dependency lifecycle scripts until they are approved. **This repository already ships the required approvals** in `package.json` → `allowScripts` (Prisma CLI/client/engines, `@swc/core`, `@parcel/watcher`, `unrs-resolver`, `es5-ext`), so a plain `npm install` is enough — no action needed.

- A warning about **2 packages (`deepmerge-ts`, `react-syntax-highlighter`)** is expected and harmless: their `prepare` scripts only run inside their own repositories and are never executed when you install them as dependencies.
- If you add a **new** dependency that ships an install script, approve it once (then `npm rebuild` if the package needs its script to function):
  ```bash
  npm install-scripts ls                 # review
  npm install-scripts approve <pkg>      # allow — writes to package.json, commit that
  ```
- Consequences of NOT approving (if you stripped the allowlist): `@prisma/engines` does not pre-download engines and `@prisma/client` does not auto-generate at install time. The project's own `postinstall` (`scripts/prisma-generate.cjs`) normally recovers both; if even that fails, the install/build now fails LOUDLY with exact remediation instead of producing a broken runtime.

## Vercel build fails: `Cannot find module '@tailwindcss/postcss'`

Log signature (Vercel build):

```text
removed 315 packages, and audited 324 packages in 5s
...
Error: Cannot find module '@tailwindcss/postcss'
    [at require (turbopack:///[turbopack-node]/transforms/postcss.ts?…)]
```

**Cause** — npm installed **without devDependencies**. npm skips them whenever
`NODE_ENV=production` is present in the install environment, and a `NODE_ENV`
variable had been added to Vercel → Settings → Environment Variables (it looks
harmless; the platform sets the value for you anyway). The audit count gives it
away: `324 packages` against a 743-entry lockfile (379 production packages
minus ~55 platform-optional binaries) instead of the full ~743. `prisma
generate` still worked because `prisma` / `@prisma/client` live in
`dependencies`.

**Fix (v0.4.5+)** — fixed in code, no dashboard change required:

- `@tailwindcss/postcss`, `tailwindcss`, `tw-animate-css`, `typescript`,
  `@types/react`, `@types/react-dom` moved from devDependencies to
  `dependencies` — everything `next build` needs now installs unconditionally;
- the repo `.npmrc` pins `include=dev`, which overrides npm's NODE_ENV default
  (verified: `NODE_ENV=production npm config get omit` → `dev` without the
  file, empty with it).

Deploy v0.4.5+ and **Redeploy with Build Cache OFF** — the restored cache still
contains the pruned `node_modules`.

**Fix without upgrading:** delete the `NODE_ENV` variable in Vercel, then
Redeploy with Build Cache OFF.

## Tables exist but the app is empty — "who creates tables and seeds?"

Nothing between `npm install` and the running app creates tables or seeds **by design** (auto-DDL inside a lifecycle hook could fire against whatever `DATABASE_URL` is set — including a production database). The responsibility is explicit:

| Context | Creates tables + seed |
|---|---|
| Local SQLite, first run | **`npm run setup`** (generate → `db push` → seed → verify counts) |
| Local, manual | `npm run db:push` then `npm run db:seed` |
| Vercel / PostgreSQL | the build itself: `vercel-build` → `scripts/prisma-deploy-db.cjs` (migrate deploy + auto-baseline + seed + verify, all failures fatal) |
| Production without demo data | deploy with `SKIP_SEED=1`, then bootstrap the owner at `/webmaster/setup` |

If `npm run db:seed` fails with `bun: command not found` (older releases hard-coded bun): update — `db:seed` now runs via `scripts/seed-run.cjs` with plain Node and falls back through bun → npx tsx automatically.

## Images not loading

- Seeded imagery lives under `/images/...` (`public/images/`) and ships with the build. **Webmaster uploads** (since v0.4.4) are stored in the database and served from `/api/uploads/<id>` — they need no files on disk.
- 404 on `/api/uploads/<id>` for a **recent** upload: the row was written to a different database than the app reads (check `DATABASE_URL`/branch), or you are on an old deployment missing the `MediaAsset` table — redeploy (the `1_add_media_asset` migration applies automatically).
- Older installs may still reference `/uploads/<name>` files under `public/uploads/` — those paths must exist under `public/` (volume-mount or copy them into the standalone bundle if you serve from it; see `docs/DEPLOYMENT.md` § 7).
- 404s on product images after deleting files: the DB still references the path — re-upload via the product editor or clear the image row.

## Telegram test fails

`/webmaster/notifications` → "Send test notification" shows the actual error. Checklist, in order:

1. **Env not configured** — the button reports *"TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not configured"*. Both variables must be set in the server's environment; restart the dev server after editing `.env`.
2. **Wrong chat id** — Telegram answers `HTTP 400`. The chat id must be the id of the chat where the bot can post (message the bot first, or add it to the group — see `docs/TELEGRAM-SETUP.md`).
3. **Wrong token** — `HTTP 401`: token revoked or typo; re-issue via @BotFather.
4. **Network** — timeouts (10 s) or DNS failures: the server needs outbound access to `api.telegram.org`. Corporate proxies must allow it.
5. Delivery attempts are recorded in the **delivery log** on the same page (`NotificationDelivery`: PENDING → SENT/FAILED, `lastError`). Failures never block orders — orders succeed even when Telegram is down.

## Login loops (redirected back to /login)

- **Plain HTTP + production build**: `NODE_ENV=production` sets the session cookie's `Secure` flag (`src/lib/auth.ts`); browsers drop Secure cookies over plain HTTP, so you bounce back to login. Serve production behind HTTPS (`docs/DEPLOYMENT.md`) — dev (`NODE_ENV` unset) works over http://localhost.
- **Cookie blocked**: check browser cookie settings / SameSite; the cookie is `me_session`, HttpOnly, SameSite=Lax.
- **Account disabled**: deactivated users fail session validation (`isActive` check) — re-enable in `/webmaster/customers` (staff) or via DB.
- **DB reset**: sessions live in the DB; restoring/resting the DB invalidates them. Log in again.

## `Invalid email or password` for EVERY password

The stored `User.passwordHash` is **not a valid bcrypt hash**. A genuine hash is
exactly **60 characters**: `$2a$` or `$2b$` + cost `10$` + 50 random chars from
the alphabet `./A-Za-z0-9` — e.g.
`$2b$10$wLMzOvdfQqs6216wZi7OTOA.XWm/vS6q4JObIn33xU9qkSrvpFYMq`.
Red flags: wrong length (anything ≠ 60), repeating patterns (`V5V5V5…`),
truncation. These usually come from manually inserting a user row in the SQL
console with an example/placeholder hash — such a row can never log in.

**Fix** — generate a real hash and update the row:

```bash
bun run hash:password "YourNewPassword123!"    # prints a 60-char hash (self-verified)
```

```sql
UPDATE "User" SET "passwordHash" = '<paste the 60-char hash>' WHERE email = 'you@example.com';
```

Or delete the broken row and let the app create the user properly:
`DELETE FROM "User" WHERE email = '…';` → `/webmaster/setup` (first OWNER) or
re-seed (`SEED_FORCE=1` on deploy, or `bun run db:seed` locally).

To rebuild the whole demo dataset **via the SQL console instead** (no CLI):
run `prisma/seed.sql` in the Neon SQL Editor — real bcrypt hashes, idempotent,
optional WIPE block at the top (see `docs/DEPLOYMENT-VERCEL.md` §3.1).

## Seed duplicates

`prisma/seed.ts` (v2) is **ensure-exists**: every seed row is keyed by a natural key (email / slug / SKU / courier code / row id) and only created when missing. Re-running `bun run db:seed` never duplicates rows, never deletes, and never overwrites rows you edited in the webmaster. If you *want* fresh demo data on SQLite: `bun run db:reset:sqlite`, then `bun run db:seed`.

## Seed "didn't insert anything" on a deployed database

This was the **v0.3.0 defect** (fixed in v0.4.0): the old seed skipped
*everything* when the users table was non-empty — a database with stray rows
(e.g. from a manual SQL import) went live with an empty catalog. The v2 seed
has **no global skip**: every deploy fills whatever rows are missing, keyed by
natural key, and repairs invalid bcrypt hashes on the documented demo accounts.

If the store is still empty after a v0.4.0 deploy:
1. **Read the build log first.** The deploy now ends with a verification table
   (`[seed:verify]` row counts + `users / products / …`). A deploy with an
   empty catalog **fails the build** — it can no longer succeed silently.
2. `https://<your-domain>/api/health` — `"seeded":false` means the catalog is
   empty; `"schema":false` means migrations never ran (check `[prisma-deploy-db]`
   Step 1 in the build log).
3. **Repair seed rows** (reset demo passwords, restore canonical demo fields):
   redeploy once with env `SEED_FORCE=1`, then remove the variable. It fills and
   repairs — it still deletes nothing.
4. **Wipe and rebuild with the official SQL (last resort):** Neon Console → SQL
   Editor → paste `prisma/seed.sql`. Uncomment the `WIPE` block at the top when
   the DB contains old/broken rows — it truncates all tables, then the INSERTs
   rebuild the exact demo dataset. Afterwards run `bun run db:baseline` against
   the database so the migration history matches, and redeploy.

## Webmaster dashboard shows "Something went wrong. Please try again."

That exact string is the API error funnel (`src/lib/api-helpers.ts`) — a
webmaster endpoint returned 500. The real cause is always in the **Vercel
function logs** (Project → Deployments → *latest* → Runtime Logs, filter
`[api]`). From v0.3.0 the funnel also maps the common database failures to
actionable messages shown in the UI:

| UI message | Cause | Fix |
|---|---|---|
| `Database configuration error (P1012)…` | a database env var is missing/invalid in the deployment settings | Add/fix `DATABASE_URL` (and `DIRECT_DATABASE_URL` for CLI) on Vercel → redeploy (mapped in v0.4.0 — B-06) |
| `Database is unreachable…` | `DATABASE_URL` wrong, Neon compute suspended, network | Check the Neon dashboard (compute active?), re-check the pooled URL, redeploy |
| `Database tables are missing…` | migrations never ran on this DB | Redeploy — the build applies migrations; watch for `[prisma-deploy-db] Step 1/3` in the build log |
| `Database schema is out of date…` | DB older than the code (missing column) | Redeploy; if a migration reports destructive changes it fails on purpose — see RUNBOOK §6 |
| `…prepared statement…` / `Add ?pgbouncer=true` | pooled Neon URL without the `pgbouncer=true` flag — Prisma's prepared statements collide with PgBouncer under the dashboard's parallel queries | Edit `DATABASE_URL` on Vercel → append `&pgbouncer=true` → redeploy |
| `Something went wrong. Please try again.` (generic) | anything else | copy the `[api] unhandled error:` line from the runtime logs |

Quick triage: `GET /api/health` → `"db":"unreachable"` = connection problem;
`"schema":false` = migrations missing; `"schema":true` + failing dashboard = read the
runtime logs for the exact Prisma error.

## Checkout rejects the shipping method

"The selected shipping method is unavailable for this order." — the checkout re-quotes rates server-side and the client-picked `shippingRateId` must match. Causes: the rate was deactivated/edited mid-session, the cart subtotal changed (free-shipping threshold crossing), or a stale cart page. Refresh the checkout page and pick again.

## Order status change returns 409

`Cannot change order status from X to Y` — the transition map (`src/lib/validators.ts`) only allows legal forward moves (e.g. `PENDING_PAYMENT → PAID`, never `COMPLETED → SHIPPED`). Cancel/refund paths are documented in `docs/DATABASE.md` § 5.

## `prisma migrate` errors on a database created by `db push`

A database whose tables were created by `db push` or an external tool has no
`_prisma_migrations` table, so `migrate deploy` refuses with P3005 / “already
exists”. The v0.4.0 deploy script **baselines automatically** (marks
`0_init` as applied without running SQL, then re-deploys — no data changes).
Manual fallback: `bun run db:baseline`, then `bun run db:migrate:status` to
confirm. Local SQLite dev does **not** use migrations: reset with
`bun run db:reset:sqlite` (drops + recreates `db/custom.db`).

## Webmaster returns 403 after login

You're signed in as a role without that capability (`src/lib/permissions.ts`). E.g. ORDER_MANAGER can't open `/webmaster/products` (content capability). Check the capability table in `docs/WEBMASTER-GUIDE.md`.

## Anonymous API returns 401

Correct behavior — all protected routes require the session cookie. For curl testing, log in first and pass the cookie jar (examples in `docs/TESTING.md`).
