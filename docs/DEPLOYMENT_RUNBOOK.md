# DEPLOYMENT RUNBOOK — MAISON ÉLAN (Vercel + Neon PostgreSQL)

Operational runbook for deploying, verifying, and recovering the platform.
Companion documents: `PRODUCTION_READINESS_AUDIT.md` (verdict + evidence), `ENVIRONMENT_VARIABLES.md` (env matrix), `DEPLOYMENT-VERCEL.md` (step-by-step first deploy), `BACKUP-RESTORE.md`, `TROUBLESHOOTING.md`.

---

## 1. System overview

```
Browser ── HTTPS ── Vercel (Next.js 16, standalone off on Vercel)
                        │  vercel-build:
                        │  prisma generate (postgres schema)
                        │  node scripts/prisma-deploy-db.cjs   ← db push + guarded seed
                        │  next build
                        ▼
                 Neon PostgreSQL ── pooled endpoint (runtime, DATABASE_URL)
                                  └─ direct endpoint (schema ops, DIRECT_DATABASE_URL)
                        ▼
                 api.telegram.org  (fire-and-forget notifications, never in DB transactions)
```

- Deploy artifact: this repository (or `maison-elan-deploy.zip`). Build entry: `npm run vercel-build` (auto-invoked by Vercel).
- Schema ops at deploy time are **automatic and safe**: `prisma-deploy-db.cjs` runs `db push`; a **failed push exits 1** so the previous deployment stays live; seed runs only on an **empty** database (guard in `prisma/seed.ts`), `SEED_FORCE=1` opts in to fill missing rows (never deletes).

## 2. Pre-deploy checklist

1. `bun run lint` → 0 problems.
2. `bun run test` → 26/26 passing.
3. `bunx tsc --noEmit` → clean (type gate is ON: type errors now fail the build).
4. `bun run seed:sql` (optional) → regenerate `prisma/seed.sql` if `prisma/seed.ts` changed.
5. Confirm env vars exist for the target environment (see `ENVIRONMENT_VARIABLES.md`).
6. Never point Preview and Production at the same Neon database.

## 3. Environment separation (Vercel project settings)

| Env var | Preview | Production | Notes |
|---|---|---|---|
| `DATABASE_URL` | Preview-branch **pooled** URL | Prod **pooled** URL | different Neon databases |
| `DIRECT_DATABASE_URL` | Preview direct URL (optional) | Prod direct URL (optional) | CLI schema ops; falls back to pooled |
| `APP_URL` | `https://<preview-domain>` | `https://maisonlantheme.vercel.app` | canonical public URL (NEXT_PUBLIC_* fallbacks accepted) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | **leave unset on Preview** (or use a test chat) | real values, or set via `/webmaster/notifications` (DB-first) | prevents preview noise in ops chat |
| `SEED_FORCE` | unset (or `1` once for a fresh preview DB) | unset | escape valve only |
| `SESSION_COOKIE_SAMESITE` | unset (auto: None+Secure on HTTPS) | unset | override only for special embeddings |

**Verification (cannot be checked from the repo — do it in the dashboard):** open Vercel → Settings → Environment Variables, confirm the Preview column and Production column point at **different** Neon URLs. Neon branch `production` vs `preview` gives this for free.

## 4. Deploy procedure

### 4.1 Preview deploy (always first)
1. `vercel deploy` (or push a non-production branch / PR).
2. Watch the build log for: `[prisma-generate]` → `[prisma-deploy-db] Schema push OK` → `[seed]` line → `next build`.
3. Smoke test (§5) on the preview URL with a **preview** database.

### 4.2 Production deploy
1. `vercel deploy --prod` (or merge to the production branch).
2. Confirm in the build log: schema push OK, seed guard line (`seed skipped` on an existing store — expected).
3. Post-deploy smoke (§5) on the production domain.
4. Immediately rotate any seeded demo credential if this DB was ever seeded (`owner@maisonelan.dev / Maison2025!` — change via the account page; or create the real owner via `/webmaster/setup` on an unseeded DB).

## 5. Smoke test checklist (run per deploy)

| # | Check | Expect |
|---|---|---|
| 0 | `GET /api/health` | 200 `{"status":"ok","db":"reachable","schema":true,"seeded":…}` — `seeded:false` on an intentionally-empty store is fine; `schema:false` or `db:"unreachable"` = stop and fix first (see TROUBLESHOOTING) |
| 1 | `GET /` renders hero + products | 200, no error boundary |
| 2 | `GET /sitemap.xml`, `/robots.txt` | 200, correct domain |
| 3 | Add to cart → checkout → place order | 201; success page shows the order **with `?email=` in URL** (new gate) |
| 4 | Success page **without** `?email=` in a fresh tab | 404 (ownership gate works) |
| 5 | `/track` with orderNumber + correct email | 200 |
| 6 | Sign in owner → `/webmaster` dashboard loads | 200 |
| 7 | Webmaster: change order status PENDING_PAYMENT→PAID | 200, history row appears |
| 8 | Webmaster: invalid transition attempt (e.g. COMPLETED→CANCELLED via API) | 409 |
| 9 | Notifications page: Test button | shows sent/failed honestly; `NotificationDelivery` row visible |
| 10 | `bun run test` in CI (or locally against a branch DB) | 26/26 |

## 6. Backup, recovery & rollback

### Backups
- **Neon built-in:** point-in-time restore (PITR) — restore window per plan; check Neon Console → Branch → Restore.
- **Manual logical backup (recommended before schema changes):**
  ```bash
  pg_dump "$DIRECT_DATABASE_URL" --format=custom --file=backup-$(date +%F).dump
  # restore:
  pg_restore --clean --if-exists --dbname "$DIRECT_DATABASE_URL" backup-YYYY-MM-DD.dump
  ```
- Local SQLite (`db/custom.db`) is dev-only — never a production asset.

### Rollback matrix
| Failure | Rollback |
|---|---|
| Bad application code | Vercel → Deployments → previous → **Promote to Production** (instant, no DB impact) |
| Bad **schema** change already pushed | **Never automatic.** Forward-fix: push a corrected schema via `db push` (deploy the fix commit). If forward-fix is impossible, restore the `pg_dump` taken before the change, then deploy the previous app version |
| Bad seed / demo data | seed never deletes; remove rows via SQL Editor or restore from dump |
| Data corruption | Neon PITR to a timestamp minutes before the incident; verify with smoke §5 |

## 7. Monitoring & incident response

- **Vercel:** Runtime Logs per deployment; set up Vercel Integrations (Slack/Datadog) for error-rate alerts if desired.
- **In-app signals:** `NotificationDelivery` (status=FAILED rows = Telegram outage/misconfig), `AdminAuditLog` (staff actions), error funnel logs (`[api] unhandled error`).
- **Investigation flow:** Vercel logs → correlate request path → check `NotificationDelivery`/`AdminAuditLog` rows → DB queries via Neon SQL Editor (read-only first).
- **Known controlled-failure paths:** Telegram outage never affects orders; rate limiter returns 429; type errors fail the build (never deploy half-broken).

## 8. Common operations

| Task | Command / action |
|---|---|
| Run tests | `bun run test` |
| Regenerate seed SQL | `bun run seed:sql` → paste `prisma/seed.sql` into Neon SQL Editor if needed |
| Reset a forgotten owner password | `bun run hash:password "NewPass"` → `UPDATE "User" SET "passwordHash"='<hash>' WHERE email='…';` (SQL Editor) |
| Fill missing demo rows | set `SEED_FORCE=1` temporarily, redeploy (fills, never deletes) |
| Rotate Telegram token | @BotFather → `/token` → `/webmaster/notifications` → save |
| Check schema drift | `bunx prisma db push --schema prisma/schema.postgres.prisma` locally against a **copy** of the DB (or rely on deploy-time push failing loudly) |

## 9. Escalation triggers (go/ no-go)

**Abort/rollback if:** smoke #1 or #3 fails; build log shows `Schema push FAILED`; error rate spikes in Vercel logs; orders stop persisting.
**Safe to continue if:** all §5 checks pass and `NotificationDelivery` shows SENT (or honestly-FAILED with a Telegram-side cause only).
