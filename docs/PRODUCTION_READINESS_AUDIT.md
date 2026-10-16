# PRODUCTION READINESS AUDIT — MAISON ÉLAN v0.3.0 → v0.4.1

**Audit date:** 2025 (Task 25) · **Re-audit addendum:** Task 26 (v0.4.0 — DB bootstrap, migrations, seed v2) · **Reconciliation & hardening:** Task 27 (v0.4.1 — document consistency, dependency scan, owner-takeover hardening, baseline drift check) · **Target:** Vercel + Neon PostgreSQL · **White-label e-commerce, Next.js 16 App Router + Prisma**

**Method:** every claim below is backed by file/symbol evidence or a command that was actually executed in the repository. Items that could not be verified from inside the sandbox are marked BLOCKED — never PASS. No production system (Vercel dashboard, Neon console) was accessed or modified.

**Statuses:** `PASS` verified · `FAIL` verified defect (fixed ⇒ noted) · `BLOCKED` needs external access/prerequisites · `N/A` not applicable with reason.

---

## 0. Task 26 addendum (v0.4.0) — database bootstrap re-audit

**Trigger:** field report after the first real deploy — *“seed tidak masuk database, dashboard webmaster: Something went wrong. Please try again.”* The generic message is the unmapped-error fallback in `src/lib/api-helpers.ts:61`; the report exposed four verified defects in the v0.3.0 provisioning chain (B-01…B-07 in §11), all fixed in v0.4.0.

**Phase 1 — database state classification (how v0.4.0 handles each scenario):**

| Scenario | State | v0.4.0 behaviour (all automatic inside `vercel-build`) |
|---|---|---|
| **A — new empty DB** | no tables | `prisma migrate deploy` applies `prisma/migrations/0_init` (25 tables) → seed fills demo content → `--verify` prints row counts as build-log proof |
| **B — valid migration history** | `_prisma_migrations` present | `migrate deploy` applies only pending migrations; seed ensure-exists touches nothing admin-owned |
| **C — tables without history** (⚠️ the user's current Neon state) | tables exist, no `_prisma_migrations` | deploy fails P3005/“database schema is not empty” → script **auto-baselines** (`prisma migrate resolve --applied 0_init`, changes no data) → retries deploy → **Step 1b drift check compares the live schema against the shipped schema — any difference is a fatal deploy error** (B-08/C-04: a baseline can no longer bless a schema it never verified) → seed fills every missing row → verify proves counts. Manual fallback: `bun run db:baseline` |
| **D — schema rewrite** | — | **NOT required and NOT performed.** The v0.3.0 schema audit passed (25 models, FKs, indexes); the incident was a provisioning-chain defect, not a schema defect. Re-verified in Task 27: the regenerated `0_init` is byte-identical to the current datamodel |

**Provisioning contract (v0.4.0, hardened in v0.4.1):** every step is **fatal in a deploy context** — a build can no longer succeed while silently producing an empty/broken store, and a baseline can no longer mark an unverified schema as valid. `SKIP_SEED=1` and `SKIP_DRIFT_CHECK=1` are the two documented escape hatches (bootstrap the owner via `/webmaster/setup`); verification then downgrades to a warning. Verified defect B-01 (see §11) restored the missing `.env.example`.

---

## 1. Command evidence log (actually executed)

| Command | Result |
|---|---|
| `bun run lint` | ✅ 0 errors, 0 warnings |
| `bunx tsc --noEmit` | ✅ clean for **all project code incl. `tests/`** (remaining hits come from sandbox-infra dirs `examples/`, `skills/` which are **not shipped** in the deploy ZIP). First pass missed the test file — see FIX A-10. |
| `bun test tests/` | ✅ **34 pass / 0 fail / 129 assertions** — the single FINAL result (re-run after every fix in Task 27; history: 26 → 28 → 33 → 34, see §7) |
| `bun prisma/seed.ts` (v2, populated DB) | ✅ ensure-exists: “Nothing to do — every seed row already exists (admin data untouched)”; counts printed |
| `bun prisma/seed.ts --verify` | ✅ prints per-table counts, exit 0; flags empty catalog exit 1 (covered by test I-11) |
| `node scripts/prisma-deploy-db.cjs` (SQLite context) | ✅ no-op, exit 0 |
| `VERCEL=1 node scripts/prisma-deploy-db.cjs` (SQLite/missing URL) | ✅ **fatal exit 1** with remediation (was: silent skip — defect B-02) |
| `VERCEL=1 DATABASE_URL=postgres…` (unreachable host) | ✅ migrate deploy fails → P1001 detected → **exit 1** with actionable message |
| `prisma migrate diff --from-empty --to-schema-datamodel` | ✅ generated `prisma/migrations/0_init/migration.sql` (25 CREATE TABLE + indexes/FKs) — version-controlled baseline |
| runtime `directUrl` probe (postgres client, `DIRECT_DATABASE_URL` unset) | ✅ runtime resolves **only** `url` (fails P1001, not P1012) → `DIRECT_DATABASE_URL` is CLI-only; runtime needs just `DATABASE_URL` |
| `bun run db:seed` | ✅ seed guard works ("Database already has 3 user(s) — seed skipped") |
| `bunx prisma db seed` | ✅ resolves the `prisma.seed` config in package.json → `bun prisma/seed.ts` |
| empty DB: `db push` + `prisma db seed` | ✅ full seed: users 3, categories 5, products 14, variants 25, banners 2, pages 7, faqs 6, couriers 3, rates 4, settings 1; owner hash = 60 chars, `bcrypt.compare("Maison2025!") = true` |
| seed re-run on populated DB | ✅ skipped, no duplication |
| storefront `GET /` | ✅ HTTP 200 |
| `prisma migrate diff --from-empty --to-schema-datamodel` vs `prisma/migrations/0_init/migration.sql` | ✅ **byte-identical modulo comments** — the shipped baseline equals the shipped schema, so a fresh DB and the datamodel cannot disagree |
| drift-check detector output formats (Task 27) | ✅ identical schemas → `-- This is an empty migration.` (comments stripped → empty → PASS); drifted schema → SQL statements → **fatal**. Live-PG execution itself is BLOCKED (no Postgres binary in the sandbox) — first real run happens in the Preview deploy log |
| fresh-install seed (CLI subprocess on a throwaway empty SQLite DB) | ✅ creates 3 demo users + full catalog; second run: “Nothing to do” (test I-11 #6) |
| `GET /api/health` (local dev, after v0.4.1 upgrade) | ✅ HTTP 200 `{status:"ok", db:"reachable", schema:true, seeded:true, time}` — booleans + timestamp only |
| dependency vulnerability scan (final) | ✅ **0 vulnerabilities** (`npm audit --omit=dev` re-run after remediation — details in the Task 27 row below) |
| dependency scan (Task 27 — full story) | ✅ **PASS — executed** (was BLOCKED). `npm audit --omit=dev` against a generated `package-lock.json` (Bun 1.3.14 has no `bun audit`). Initial result: **24 vulnerabilities (1 low, 7 moderate, 14 high, 2 critical)** — 2× critical sat directly on direct deps (`next`, `next-auth`). Remediation (all in `package.json`): `next ^16.4.2`, `next-auth ^4.24.15`, `next-intl ^4.14.9`, `uuid ^11.1.1`, `sharp ^0.35.5`, `prisma`/`@prisma/client` pinned `6.12.0` (below the 6.13.0-dev…7.10.0 advisory range for every package manager), `overrides: { "defu": "^6.1.7" }`, and **two orphan dependencies removed** (`@mdxeditor/editor`, `react-syntax-highlighter` — imported nowhere in `src/`, verified by repo-wide grep; removing them cleared their transitive `js-yaml`/`prismjs`/`refractor` advisories). Final re-scan: **0 vulnerabilities**. Continuous control: Dependabot/osv-scanner in CI on the buyer's first GitHub push. |
| `next build` / Vercel build | ⛔ **BLOCKED** — cannot execute a full production build from the sandbox (dev-server port policy). Verified instead: tsc clean + lint clean + `vercel-build` script chain reviewed (`package.json` → `prisma generate --schema prisma/schema.postgres.prisma && node scripts/prisma-deploy-db.cjs && next build`). First real evidence lands in the Vercel build log during the preview deploy (see RUNBOOK). |

---

## 2. Build / TypeScript / lint / tests / dependencies

| Item | Status | Evidence |
|---|---|---|
| TypeScript strict gate | **PASS** (fixed) | `next.config.ts` previously had `typescript.ignoreBuildErrors: true` — a silent-broken-build risk. Now `false`; `tsc --noEmit` is clean so the gate is safe. **[FIX A-04]** |
| ESLint | **PASS** | `bun run lint` → 0 problems (whole repo) |
| Test suite | **PASS** (extended) | `tests/invariants.test.ts`, **34 tests / 129 assertions** (final), `bun test` runner (no new deps). Previously the repo shipped **zero** automated tests (documented decision D-06). **[FIX A-05, extended B-06/B-07 → I-11, C-02 → S-01 case]** |
| Dependency vulnerabilities | **PASS** (Task 27 — was BLOCKED) | scan executed → 24 findings (2 critical: `next`, `next-auth`) → remediated → re-scan **0**. Details & exact versions: §1 evidence log. Continuous control: Dependabot/osv-scanner in CI. |
| Framework/versions | **PASS** | Next `^16.4.2`, React 19, Prisma `6.12.0` (**pinned** — keeps every package manager below the 6.13.0-dev…7.10.0 advisory range), TypeScript 5, `bun.lock` (canonical) + generated `package-lock.json` (npm reproducibility) shipped |

## 3. Database / Prisma

| Item | Status | Evidence |
|---|---|---|
| Schema integrity | **PASS** | `prisma/schema.prisma` (SQLite, local) and `prisma/schema.postgres.prisma` (Neon) differ only in the datasource block; 25 models, monetary values integer minor units, no enums/scalar lists in schema (validated by Zod) |
| Indexes / FKs | **PASS** | FK `onDelete` rules on all relations; indexes on every hot lookup path (Order `status`, `userId`, `createdAt`; ProductVariant `productId`; Session `token` unique, `expiresAt`; OrderStatusHistory `(orderId, createdAt)`, etc.) |
| Migrations | **PASS (upgraded)** | v0.3.0 used `db push` with **no history** (defect B-05). v0.4.0 ships `prisma/migrations/0_init` (baseline of `schema.postgres.prisma`) + `migration_lock.toml`; deploy chain is now `prisma migrate deploy` with **automatic baseline** for databases that already have tables (P3005 → `migrate resolve --applied 0_init` → retry, no data touched). **Task 27 [FIX C-04]:** the baseline trigger is deliberately narrow (only the official P3005 signature — broad phrases like “already exists” also match unrelated failures and could bless a wrong schema), and a **Step 1b drift check** (`prisma migrate diff --from-url … --to-schema-datamodel … --script`) compares the live schema against the shipped schema after every provisioning — non-empty diff ⇒ **fatal** with remediation (`SKIP_DRIFT_CHECK=1` to opt out; tool failure ⇒ loud warning, never a false PASS). The regenerated `0_init` is proven byte-identical to the datamodel. `db push` demoted to a repair tool (`db:push:pg`). Local SQLite keeps `db push` (migrations are postgres-only by design) |
| Transaction boundaries | **PASS** (fixed) | checkout: stock decrement + order + items + status history in one `$transaction` with an **atomic conditional decrement** (`updateMany where stock >= qty`) — oversell now impossible under SQLite *and* Postgres READ COMMITTED. **[FIX A-01]** Cancel-restock moved **inside** the order-update transaction and gated on `enforceStock`. **[FIX A-03]** |
| Connection lifecycle | **PASS** | `src/lib/db.ts` — PrismaClient singleton on `globalThis` (no per-request clients); serverless-safe |
| Neon pooling | **PASS** (documented + verified against the actual stack, Task 27) | `DATABASE_URL` = Neon **pooled** URL for runtime; `DIRECT_DATABASE_URL` (direct) used only by CLI schema ops with pooled fallback (`scripts/prisma-deploy-db.cjs`). Guidance `?sslmode=require&pgbouncer=true` on the pooled URL (and **not** on the direct one) matches the stack actually shipped: **Prisma 6.12.0 `prisma-client-js`, no driver adapters** (`src/lib/db.ts` instantiates `PrismaClient` directly) — under transaction-mode PgBouncer the flag disables named prepared statements, exactly the failure mode observed on the webmaster dashboard. The stale phrase “ends with ?pgbouncer=true” (which dropped `sslmode=require`) was corrected in `prisma-deploy-db.cjs` **[FIX C-05]** |

## 4. Environments / configuration / secrets

| Item | Status | Evidence |
|---|---|---|
| Env separation Preview vs Production | **BLOCKED** (dashboard access) | cannot verify Vercel project settings from the sandbox. Required setup documented in `docs/ENVIRONMENT_VARIABLES.md` + RUNBOOK §3. Code side is correct: all secrets server-only. |
| Secret exposure in code | **PASS** | full `process.env` inventory: only `APP_URL`/`NEXT_PUBLIC_*` (non-secret), `SESSION_COOKIE_SAMESITE`, `NODE_ENV`, `TELEGRAM_*` (in `server-only` modules), `DATABASE_URL` (Prisma engine only). No NEXT_PUBLIC secret, no JWT. |
| Secret exposure over API | **PASS** | `/api/webmaster/telegram/config` returns masked values only (`telegram-config.ts` `maskToken/maskChatId`); delivery log `target` stores masked chat id; verified by test I-7/I-10. |
| `.env.example` accuracy | **PASS** | ships in ZIP; matches `ENVIRONMENT_VARIABLES.md`. |
| Demo credentials risk | **PASS** (hardened, Task 27) | seed creates `owner@maisonelan.dev / Maison2025!` **only while the users table is EMPTY** (fresh demo install). Once ANY user exists, missing demo users are never re-created — a redeploy can no longer resurrect a publicly documented OWNER password on a production store **[FIX C-02]**. Existing demo accounts keep the invalid-hash self-heal (test I-11) and `SEED_FORCE=1` remains an explicit repair tool. SECURITY.md + RUNBOOK instruct rotation/`/webmaster/setup` on real installs |

## 5. Authentication / authorization / input validation / rate limiting

| Item | Status | Evidence |
|---|---|---|
| Session auth | **PASS** | custom DB sessions (`src/lib/auth.ts`): 32-byte random tokens, **SHA-256-hashed at rest**, HttpOnly cookie, 30-day TTL, expired/inactive users rejected |
| Password hashing | **PASS** | bcryptjs cost 10; strength policy ≥8 chars letters+digits |
| Webmaster route gating | **PASS** | all 20 webmaster route files call `requireStaff(capability)` as the first statement; capability map `src/lib/permissions.ts`; verified by tests I-5 (401 anon / 403 customer / 403 wrong-capability / audit row written) |
| Page-level gating | **PASS** | `webmaster/(dashboard)/layout.tsx` redirects non-staff; `account/*` layouts require session |
| Ownership enforcement | **PASS** (fixed) | `GET /api/orders` scoped by `userId`; `/account/orders/[id]` ownership check; `/api/track` 2-factor (orderNumber+email). **Checkout success page previously had NO gate** — now registered orders require the owner session, guest orders require matching `?email=`. **[FIX A-02]** (test I-4) |
| Input validation | **PASS** | Zod schemas on every JSON-consuming route (`src/lib/validators.ts`); malformed JSON → controlled 500 (test I-8) |
| Rate limiting | **PASS** (accepted risk) | in-memory limiter on all abuse-prone public endpoints (login 10/min + 8/min per email, register 5/min, forgot 5/5min, checkout 10/min, track 20/min, setup 5/5min). Single-process by design — swap Map→Redis for multi-instance (accepted risk R-1) |
| Owner bootstrap | **PASS** (fixed twice) | `/api/webmaster/setup` only usable while 0 OWNERs; check+create share one transaction (A-08). **Task 27 [FIX C-03]:** on PostgreSQL the transaction alone does not serialize (READ COMMITTED lets two concurrent bootstraps both read count 0) — a transaction-scoped `pg_advisory_xact_lock(742191117)` now serializes the critical section; the loser re-reads the count and gets 409. SQLite path unchanged (single writer) |
| Password reset | **PASS** (accepted risk) | uniform responses (no enumeration), SHA-256-hashed single-use tokens. ⚠️ SMTP not integrated: raw token returned only when `NODE_ENV !== "production"` (Vercel always sets production → no leak on Preview/Prod; local dev only). Accepted risk R-3. |

## 6. Business integrity (pricing / stock / checkout / orders / shipping)

| Item | Status | Evidence |
|---|---|---|
| Server-side pricing | **PASS** | `checkoutSchema` accepts **no price fields**; `createOrderFromCheckout` recomputes from DB (`orders.ts` — `effectiveUnitPriceCents(product) + variant.priceDeltaCents`); shipping re-quoted from DB; client-supplied extra fields stripped by Zod. Test I-1: injected `totalCents: 1` ignored, real total enforced |
| Inventory consistency | **PASS** (fixed) | atomic conditional decrement **[FIX A-01]**; test I-2: two concurrent checkouts of stock=2/qty=2 → exactly one 201, one 409, stock=0 |
| Duplicate checkout | **PASS** | `idempotencyKey` unique index; same key replays the original order; concurrent duplicates → exactly one row (test I-3). Minor UX note: the racing loser may receive 409 instead of a replay — integrity unaffected |
| Order state machine | **PASS** | `ORDER_TRANSITIONS` allow-list + `assertTransition`; invalid transitions → 409 with **no write** (test I-6). Shipment auto-mirrors hand-roll equivalent allow-lists (kept in sync; flagged as tech-debt note T-2) |
| Manual tracking / privacy | **PASS** | shipment updates staff-gated (`shipping` capability); customers see only their own orders; tracking page 2-factor |
| Cancel semantics | **PASS** (fixed) | cancellation sets `cancelledAt`, restocks only when stock enforcement was on, all inside the transaction **[FIX A-03]** |

## 7. Automated invariant tests (new — `tests/invariants.test.ts`)

Isolation: throwaway SQLite DB in `os.tmpdir()` (schema pushed per run, file deleted after), `next/headers` cookie-jar mock, fetch stubbed (no network). The seed suite additionally proves its fresh-install contract in a **separate CLI subprocess** with its own empty DB. **34 tests / 129 assertions, all passing** — the single final result (history 26 → 28 → 33 → 34). Type-checked as part of the main tsconfig (see FIX A-10).

| # | Invariant | Tests |
|---|---|---|
| I-1 | Client prices cannot override server totals | 2 |
| I-2 | Concurrent checkouts cannot oversell | 1 |
| I-3 | Repeated/concurrent checkout → no duplicate orders | 2 |
| I-4 | Customers cannot read/see others' orders (API + success page) | 5 |
| I-5 | Unauthorized users cannot execute webmaster actions | 5 |
| I-6 | Invalid status transitions rejected, no write | 2 |
| I-7 | Telegram failure never rolls back an order; masked config only | 2 |
| I-8 | DB errors → controlled messages, no secret leakage (incl. **P1012** mapping — B-06) | 3 |
| I-9 | Notification config isolation (env vs DB precedence) | 2 |
| I-10 | Public/staff responses expose no private data | 3 |
| I-11 | Bootstrap seed: fills catalog exactly once; idempotent re-run; ensure mode never overwrites admin rows; force mode repairs; broken bcrypt hashes self-heal; never deletes non-seed rows; verify flags an empty catalog and seed self-repairs it (B-03/B-04/B-07); **S-01: NEVER creates demo users on a populated DB (no credential resurrection) + fresh-install CLI subprocess creates them on an empty DB** | 6 |

Note: I-2/I-3 use 2 concurrent requests (3+ concurrent interactive transactions can deadlock SQLite in-process — a test-harness limitation, not a product defect; Postgres/Native target unaffected).

## 8. Telegram integration

| Item | Status | Evidence |
|---|---|---|
| Failure isolation | **PASS** | `notify()` fire-and-forget, never awaited inside transactions; order committed 201 while delivery fails (test I-7); delivery logged `FAILED` with bounded error text |
| Retries | **PASS** | 3 attempts, linear backoff, 10s timeout, 4xx (non-429) permanent |
| Token safety | **PASS** | DB-first credentials (`StoreSetting id="telegram"`) with env fallback; masked everywhere client-visible; audit meta stores masked chat id only |
| Duplicate notifications | **N/A** | at-most-one delivery row per event per action; retries target the same row — no fan-out duplication path exists |
| Outbound rate limiting | **N/A (accepted)** | relies on Telegram 429 handling; notification volume is store-operator scale |

## 9. Cache / SEO / UX / error states

| Item | Status | Evidence |
|---|---|---|
| Caching | **PASS** | 14 pages `force-dynamic`; no stale-price/stale-stock window; no ISR surprises. (Perf note: everything uncached is intentional for correctness; revisit with ISR for catalog pages later) |
| SEO | **PASS** | `robots.ts` disallows `/webmaster`, `/account`, `/checkout`, `/api`; DB-driven `sitemap.ts` with fallback; white-label metadata from StoreSettings |
| Responsive / accessibility | **PASS** (design-level) | Tailwind responsive prefixes throughout, semantic landmarks, aria labels on interactive storefront sections, 44px+ touch targets; full manual checklist in `docs/TESTING.md` |
| Error states | **PASS** (fixed) | added branded `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` **[FIX A-06]** — previously framework-default screens |
| Security headers | **PASS** (fixed) | `next.config.ts` now sets `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. **No** `X-Frame-Options`: the platform preview panel embeds the app cross-site (deliberate, documented). CSP deferred (R-4) |

## 10. Monitoring / backup / rollback / docs

| Item | Status | Evidence |
|---|---|---|
| Logging | **PASS** | error funnel logs server-side (`console.error("[api] …")`) without leaking internals; Telegram failures recorded in `NotificationDelivery.lastError`; `AdminAuditLog` covers staff actions |
| Monitoring/alerting | **BLOCKED** | no external APM/Sentry configured (would need dashboard access). Vercel built-in logs + Telegram operational alerts are the current floor — RUNBOOK §7 |
| Backup/recovery | **PASS** (documented) | Neon PITR + manual `pg_dump` procedure documented in RUNBOOK §6 / `docs/BACKUP-RESTORE.md` |
| Rollback | **PASS** (documented) | Vercel instant rollback + DB forward-fix policy in RUNBOOK §6 (schema rollback is never automatic — documented honestly) |
| README / docs | **PASS** | INSTALLATION / DEPLOYMENT-VERCEL / TROUBLESHOOTING / TESTING / SECURITY all present; SECURITY.md corrected this audit (see defect D-7) |

---

## 11. Verified defects found & remediation (final state)

| ID | Sev | Defect (evidence) | Fix | Test |
|---|---|---|---|---|
| A-01 | **Critical** | Oversell window on Postgres: in-tx `findUnique` re-check + unconditional `decrement` both pass under READ COMMITTED concurrency (`src/lib/orders.ts` checkout tx) | replaced with atomic conditional `updateMany({ where: { id, stock: { gte: qty } } })`; count===0 → 409 rollback | I-2 ✅ |
| A-02 | **High** | `/checkout/success/[orderNumber]` rendered full order contents to anyone holding the 6-hex order number; also pre-filled customer email into a URL | ownership gate: registered orders require owner session; guest orders require matching `?email=`; checkout redirect carries the email param | I-4 ✅ |
| A-03 | **High** | Cancel-restock ran **outside** the `$transaction`, unconditionally (stock inflation in `enforceStock=false` stores; partial-restock drift on mid-loop failure) (`webmaster/orders/[id]/route.ts`) | restock moved inside the tx, gated on `enforceStock`, via `updateMany` (deleted variants safe) | I-6/I-5 ✅ (no-regression) |
| A-04 | **High** | `typescript.ignoreBuildErrors: true` shipped type-broken builds silently | `false` (tsc clean); type errors now fail builds | lint+tsc ✅ |
| A-05 | **High** | Zero automated tests | new `tests/invariants.test.ts` (26 tests at fix time; the suite has since grown — final **34 tests / 129 assertions**, see §7) + `bun run test` | 26/26 at fix time; **34/34 final** ✅ |
| A-06 | Medium | No `not-found`/`error`/`global-error` boundaries | branded pages added | manual |
| A-07 | Medium | `SECURITY.md` documented a nonexistent `/api/upload` route (overstated controls) | corrected: uploads not implemented; images by URL | doc review ✅ |
| A-08 | Medium | Owner-bootstrap TOCTOU (count-then-create race) | check+create in one transaction | code review ✅ |
| A-09 | Low | Checkout idempotency fallback (`Date.now()+Math.random`) violated the UUID schema → latent 422 | RFC-4122 v4 fallback via `crypto.getRandomValues` | code review ✅ |
| A-10 | **High** | `tests/` is inside the Next tsconfig include scope (`**/*.ts`); with `ignoreBuildErrors: false` (A-04) the 16 type errors in the new test file (untyped `bun:test` module, `Route` handler type rejecting concrete args, `RequestInit` nullability, `fetch`-stub casts under bun-types) would have **broken the Vercel build** | targeted type fixes only, zero behavior change: `/// <reference types="bun-types" />`, `Route` args `never[] \| unknown[]`, narrowed `req()` init, real `TelegramConfigStatus` type import, fetch stubs cast via `unknown` | `tsc --noEmit` fully clean incl. tests/ ✅ · tests re-run ✅ · lint ✅ |
| C-01 | **Critical** | Dependency vulnerabilities never scanned (audit gate BLOCKED since Task 25). Task 27 executed the scan: **24 vulnerabilities (1 low, 7 moderate, 14 high, 2 critical)** — criticals on direct deps `next` (self-hosted DoS via Image Optimizer `remotePatterns` + HTTP request deserialization) and `next-auth` (email-normalizer homoglyph bypass, `getToken()` throw) | `package.json` remediation: `next ^16.4.2`, `next-auth ^4.24.15`, `next-intl ^4.14.9`, `uuid ^11.1.1`, `sharp ^0.35.5`, `prisma`/`@prisma/client` pinned `6.12.0` (below the 6.13.0-dev…7.10.0 advisory range for every package manager), `overrides: { "defu": "^6.1.7" }`; orphan deps `@mdxeditor/editor` + `react-syntax-highlighter` **removed** (imported nowhere — repo-wide grep; removal cleared their transitive `js-yaml`/`prismjs`/`refractor` advisories); `bun.lock` + `package-lock.json` regenerated | re-scan: **0 vulnerabilities** ✅ · tsc/lint/tests all green ✅ |
| C-02 | **High** | **Owner-takeover path via seed resurrection:** `ensureUsers` re-created any missing demo user on every deploy. A buyer who deleted `owner@maisonelan.dev` (or renamed their own account) silently got it back — with the **publicly documented** password — on the next deploy | demo users are created **only while the users table is EMPTY**; once any user exists the seed never re-creates them (existing demo accounts keep the invalid-hash self-heal and explicit `SEED_FORCE` repair; nothing is deleted) | I-11 #1 (populated DB ⇒ `created.users === 0`, demo emails absent) + I-11 #6 (fresh empty DB ⇒ 3 demo users) ✅ |
| C-03 | **High** | Owner-bootstrap race on PostgreSQL: the A-08 transaction guarantees serialization only on SQLite (single writer); under Postgres READ COMMITTED two concurrent first-run submissions could both read `ownerCount === 0` and create **two OWNER accounts** | transaction-scoped `pg_advisory_xact_lock(742191117)` inside the setup transaction when the runtime targets Postgres; the second submission blocks, re-reads the count after the winner commits, and gets 409. SQLite path unchanged | code review ✅ (live-PG concurrency proof pending Preview — gate §14 #4) |
| C-04 | **High** | **Auto-baseline could mark a wrong schema as valid:** the trigger regex matched broad phrases (“already exists” also occurs in unrelated failures), and baselining only fixes migration *history* — a DB built from an older schema (e.g. v0.2 `db push`) would be marked valid while missing newer columns, surfacing later as random 500s | trigger narrowed to the official P3005 signature; new **Step 1b drift check** (`prisma migrate diff --from-url … --to-schema-datamodel … --script`) fails the deploy on any live-vs-shipped schema difference, with remediation steps and `SKIP_DRIFT_CHECK=1` as the documented escape hatch (tool failure degrades to a loud warning — never a false PASS) | output-format verification ✅ (identical → empty script; drift → SQL) · live-PG run pending Preview — gate §14 #3 |
| C-05 | Low | Stale connection-string hint inside `prisma-deploy-db.cjs` (“ends with ?pgbouncer=true”) omitted `sslmode=require` — following it verbatim would produce a URL Neon rejects | hint corrected to `?sslmode=require&pgbouncer=true`; the full guidance in `ENVIRONMENT_VARIABLES.md` / `DEPLOYMENT-VERCEL.md` re-verified against the shipped stack (Prisma 6.12.0, prisma-client-js, no driver adapters) | doc review ✅ |
| B-01 | **Critical** | `.env.example` **missing from the working tree** (regression after the v0.3.0 ZIP was cut — the file existed in the ZIP but vanished from `./`); fresh clones from the tree would have no env documentation. ⚠️ **Recurred during Task 27** (the file vanished again after the v0.4.0 rebuild) and was **caught by the ZIP verification procedure itself** (`.env.example` checked inside the archive before shipping) — the procedure works | restored (Task 27: reconstructed to match `docs/ENVIRONMENT_VARIABLES.md` exactly, incl. the new `SKIP_DRIFT_CHECK`); ZIP verification procedure (check `.env.example` before `zip`) re-affirmed in RELEASE-CHECKLIST | `unzip -l … \| grep .env.example` ✅ |
| B-02 | **Critical** | `prisma-deploy-db.cjs` v1 **skipped provisioning silently on Vercel** when `DATABASE_URL` was missing/SQLite (warn + exit 0) → “successful” build with zero tables → every API hit the generic 500 fallback → webmaster “Something went wrong. Please try again.” | v2: VERCEL + missing/non-postgres URL ⇒ **exit 1** with exact remediation steps; the build can no longer produce a site without a usable database | CLI scenario tests §1 ✅ |
| B-03 | **Critical** | seed v1 global guard (`user.count() > 0 → skip everything`): any stray user row (manual SQL, external dump) made the seed skip the **entire** catalog → live store with empty products/categories — the reported “seed tidak masuk database” | seed v2 **ensure-exists per natural key** (email/slug/sku/code/id): fills every missing row, never deletes, never overwrites admin-owned rows | I-11 ✅ |
| B-04 | **High** | v1 seed failure = warn + exit 0 (broken deploy could ship silently) | v2: seed failure ⇒ **exit 1** unless `SKIP_SEED=1` | CLI scenario tests §1 ✅ |
| B-05 | **High** | no migration history: schema existed only as “whatever db push last did” — unreproducible for buyers, undrifiable, drift-prone | `prisma/migrations/0_init` baseline + `prisma migrate deploy` in the build chain, with **auto-baseline** (resolve → retry) for pre-existing databases; `db:baseline` / `db:migrate:status` scripts added | `migrate diff` evidence §1 ✅ · applied on first real deploy |
| B-06 | Medium | P1012 (missing/invalid DB env var at runtime) fell through to the generic 500 — exactly the unactionable message the user reported | mapped in `handleError` to an actionable message (checks `DATABASE_URL`/`DIRECT_DATABASE_URL`); empirically verified runtime resolves only `url` (P1001, not P1012, when `directUrl` env is unset) | I-8 ✅ |
| B-07 | Low | demo account with an **invalid bcrypt hash** (external SQL dump damage) could never log in and v1 seed would never repair it | self-heal: non-bcrypt hash on a documented demo account is repaired in ensure mode; `SEED_FORCE=1` resets demo passwords on demand; never touches real password changes (always valid bcrypt) | I-11 ✅ |

## 12. Accepted risks (documented, explicitly accepted)

| ID | Risk | Rationale / mitigation |
|---|---|---|
| R-1 | In-memory rate limiter (single-process) | current scale = single Vercel function region; swap Map→Redis when multi-instance |
| R-2 | ~~`prisma db push` instead of migration history~~ **RESOLVED in v0.4.0** — migration history shipped (`0_init` baseline + `migrate deploy` + auto-baseline); `db push` remains only as an explicit repair tool | — |
| R-3 | SMTP not integrated for password reset | dev-only token exposure (`NODE_ENV` gate); integrate a provider before allowing self-serve resets in production (admin-assisted reset via SQL tool `hash:password` documented) |
| R-4 | No CSP yet | needs an inline-nonce pass over Next's bootstrap; scheduled hardening, non-blocking |
| R-5 | ~~Dependency vulnerability scan unavailable in sandbox~~ **RESOLVED in v0.4.1** — scan executed (24 findings) and remediated to **0**; Dependabot/osv-scanner in CI remains the continuous control on the buyer's repo | — |
| R-6 | Preview/Prod env separation not verifiable from sandbox | RUNBOOK §3 gives the exact expected Vercel configuration to apply/verify manually |

## 13. Release verdict

> ### **READY FOR PREVIEW VALIDATION — production-ready claim is NOT yet earned**
>
> **Status per the Task 27 reconciliation:** every gate that can be verified inside the sandbox passes with executable evidence (34 automated tests / 129 assertions, lint, tsc, verified seed chain, deterministic 3-step provisioning + drift check, dependency scan at **0 findings**). But the deployment claim remains **unproven**: the full Vercel build, a real Neon database (fresh + legacy-without-history), the Vercel environment matrix, and live-PG concurrency have never been executed in front of a witness. The correct posture is exactly the one the reviewer demanded: *ready to ENTER Preview validation, not entitled to claim production-ready without conditions*.
>
> **Task 26 addendum:** the first real deploy exposed the provisioning-chain defects B-01…B-07 (empty database + generic dashboard error). All are fixed with executable evidence and the failure mode “deploy succeeds but the store is empty” is now structurally impossible: env problems, migration problems and empty-catalog outcomes each fail the build with their own actionable message, and the build log ends with per-table row counts as proof of a populated store.
>
> **Task 27 reconciliation:** the audit document itself contained inconsistencies (stale test counts “28 tests / 90 assertions” in this addendum vs “33/125” elsewhere) — reconciled to a single final result (**34 tests / 129 assertions**). The dependency gate was un-blocked and executed (**24 → 0 vulnerabilities**, two criticals fixed). Two owner-takeover paths were closed (C-02 seed resurrection, C-03 Postgres bootstrap race) and the auto-baseline can no longer bless an unverified schema (C-04). All are in §11 with tests.
>
> **Do not deploy straight to Production.** Deploy to **Preview** first, execute §14 Release Validation Gates + RUNBOOK §4 smoke tests, and only promote once every gate is checked with real evidence.

**Next safest action:** push this build to Vercel as a **Preview** deployment with the env matrix from `docs/ENVIRONMENT_VARIABLES.md`, execute §14 + RUNBOOK §4, then promote to Production.

---

## 14. Release validation gates (Task 27 — check only with real evidence)

| # | Gate | Status | Evidence / what is still missing |
|---|---|---|---|
| 1 | Lint, TypeScript, automated tests | ✅ **verified** | lint 0 · tsc clean (project incl. `tests/`) · **34 pass / 0 fail / 129 assertions** |
| 2 | Fresh install on an empty Neon DB | ⛔ **pending Preview** | closest sandbox evidence: CLI subprocess seeds an empty DB end-to-end (I-11 #6); `0_init` ≡ datamodel (byte-identical). No Postgres binary exists in the sandbox — first real proof = Preview deploy build log |
| 3 | Legacy DB without migration history (schema drift) | ⚙️ **mechanism shipped, live run pending** | auto-baseline trigger narrowed to P3005 + Step 1b drift check (C-04) with verified output formats; live-PG execution pending Preview |
| 4 | Owner bootstrap & demo-account security | ✅ **source-audited + fixed** | takeover paths closed: C-02 (resurrection ban, test-proven) and C-03 (advisory lock; code-reviewed — live-PG concurrency proof pending Preview) |
| 5 | Repeated seed & parallel deploys | ✅ **idempotency test-proven** | ensure/force/fresh subprocess tests (I-11); true parallel-deploy proof pending Preview |
| 6 | Vercel Preview & environment isolation | ⛔ **pending** | RUNBOOK §3 checklist (env matrix per environment) must be applied and eyeballed in the dashboard |
| 7 | Dependency vulnerability scan | ✅ **executed, 0 findings** | was BLOCKED; Task 27 scan → 24 findings → remediated → re-scan 0; keep Dependabot/osv-scanner on the buyer repo |

**Score: 4 of 7 gates verified** (1, 4, 5, 7) · 1 mechanism shipped awaiting live proof (3) · 2 require the Preview deployment itself (2, 6).

---

**Post-audit addendum (same release — added after first-deployment feedback):**

- `GET /api/health` deployment probe added — public, returns only `{status, db, schema, seeded, time}` booleans; distinguishes unreachable DB / missing schema / empty store in one request (RUNBOOK smoke step #0). Re-verified in Task 27: the implementation returns booleans + a timestamp only — no counts, no identifiers, no connection strings, no error internals; an unreachable DB and a missing schema both yield 503 without leaking which query failed. The `seeded:false` + HTTP 503 state of a `SKIP_SEED=1` store that has not yet bootstrapped is intentional: it is an operator signal to run `/webmaster/setup`, not a malfunction.
- The API error funnel now maps connection-level failures (unreachable DB, missing/outdated tables, PgBouncer prepared-statement conflicts) to actionable UI messages — with no secret/internals leakage (covered by the I-8 tests).
- Neon pooled `DATABASE_URL` guidance corrected everywhere (`.env.example`, ENVIRONMENT_VARIABLES, DEPLOYMENT-VERCEL): `?sslmode=require&pgbouncer=true` is REQUIRED on the pooled URL — without the flag Prisma's named prepared statements collide with Neon's PgBouncer under the dashboard's parallel queries (matches the reported "Something went wrong" on /webmaster). Task 27 re-verified this guidance against the stack actually shipped (Prisma 6.12.0, prisma-client-js, no driver adapters) — see §3.
- Invariant suite progression (historical snapshots, superseded by the §7 final result): 26 (Task 25) → 28 tests / 90 assertions (health probe + error-mapping) → 33 tests / 125 assertions (I-11 seed suite) → **34 tests / 129 assertions (Task 27 final — S-01 cases + fresh-install CLI subprocess)**. Every older count in this document is a historical snapshot of when it was written; §1/§2/§7/§13 carry the one authoritative number.
