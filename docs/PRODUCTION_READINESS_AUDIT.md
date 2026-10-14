# PRODUCTION READINESS AUDIT — MAISON ÉLAN v0.3.0

**Audit date:** 2025 (Task 25) · **Target:** Vercel + Neon PostgreSQL · **White-label e-commerce, Next.js 16 App Router + Prisma**

**Method:** every claim below is backed by file/symbol evidence or a command that was actually executed in the repository. Items that could not be verified from inside the sandbox are marked BLOCKED — never PASS. No production system (Vercel dashboard, Neon console) was accessed or modified.

**Statuses:** `PASS` verified · `FAIL` verified defect (fixed ⇒ noted) · `BLOCKED` needs external access/prerequisites · `N/A` not applicable with reason.

---

## 1. Command evidence log (actually executed)

| Command | Result |
|---|---|
| `bun run lint` | ✅ 0 errors, 0 warnings |
| `bunx tsc --noEmit` | ✅ clean for **all project code incl. `tests/`** (remaining hits come from sandbox-infra dirs `examples/`, `skills/` which are **not shipped** in the deploy ZIP). First pass missed the test file — see FIX A-10. |
| `bun test tests/` | ✅ **26 pass / 0 fail / 77 assertions** (new suite, see §7) |
| `bun run db:seed` | ✅ seed guard works ("Database already has 3 user(s) — seed skipped") |
| `bunx prisma db seed` | ✅ resolves the `prisma.seed` config in package.json → `bun prisma/seed.ts` |
| empty DB: `db push` + `prisma db seed` | ✅ full seed: users 3, categories 5, products 14, variants 25, banners 2, pages 7, faqs 6, couriers 3, rates 4, settings 1; owner hash = 60 chars, `bcrypt.compare("Maison2025!") = true` |
| seed re-run on populated DB | ✅ skipped, no duplication |
| storefront `GET /` | ✅ HTTP 200 |
| dependency vulnerability scan | ⛔ **BLOCKED** — `bun pm audit` is not a supported command in Bun 1.3.14 and there is no `package-lock.json` for `npm audit`. Recommended: enable GitHub Dependabot or run `osv-scanner` against `bun.lock` in CI (see §9 backlog). |
| `next build` / Vercel build | ⛔ **BLOCKED** — cannot execute a full production build from the sandbox (dev-server port policy). Verified instead: tsc clean + lint clean + `vercel-build` script chain reviewed (`package.json` → `prisma generate --schema prisma/schema.postgres.prisma && node scripts/prisma-deploy-db.cjs && next build`). First real evidence lands in the Vercel build log during the preview deploy (see RUNBOOK). |

---

## 2. Build / TypeScript / lint / tests / dependencies

| Item | Status | Evidence |
|---|---|---|
| TypeScript strict gate | **PASS** (fixed) | `next.config.ts` previously had `typescript.ignoreBuildErrors: true` — a silent-broken-build risk. Now `false`; `tsc --noEmit` is clean so the gate is safe. **[FIX A-04]** |
| ESLint | **PASS** | `bun run lint` → 0 problems (whole repo) |
| Test suite | **PASS** (added) | `tests/invariants.test.ts`, 26 tests, `bun test` runner (no new deps). Previously the repo shipped **zero** automated tests (documented decision D-06). **[FIX A-05]** |
| Dependency vulnerabilities | **BLOCKED** | no npm lockfile, `bun pm audit` unsupported in 1.3.14. Mitigation: Dependabot / osv-scanner in CI. |
| Framework/versions | **PASS** | Next `^16.1.1`, React 19, Prisma `^6.11.1`, TypeScript 5, `bun.lock` present. Node engines: not pinned — Vercel uses Node 22 by default; no code depends on engines. |

## 3. Database / Prisma

| Item | Status | Evidence |
|---|---|---|
| Schema integrity | **PASS** | `prisma/schema.prisma` (SQLite, local) and `prisma/schema.postgres.prisma` (Neon) differ only in the datasource block; 25 models, monetary values integer minor units, no enums/scalar lists in schema (validated by Zod) |
| Indexes / FKs | **PASS** | FK `onDelete` rules on all relations; indexes on every hot lookup path (Order `status`, `userId`, `createdAt`; ProductVariant `productId`; Session `token` unique, `expiresAt`; OrderStatusHistory `(orderId, createdAt)`, etc.) |
| Migrations | **N/A (documented)** | project uses `prisma db push` via `scripts/prisma-deploy-db.cjs` (idempotent schema sync) — no `migrations/` history exists. Push **fails the build** on destructive changes so a bad schema can't take down the previous deployment. Rollback = forward-fix (documented in RUNBOOK §6). For teams preferring migration history, switch to `prisma migrate deploy` — RUNBOOK §5. |
| Transaction boundaries | **PASS** (fixed) | checkout: stock decrement + order + items + status history in one `$transaction` with an **atomic conditional decrement** (`updateMany where stock >= qty`) — oversell now impossible under SQLite *and* Postgres READ COMMITTED. **[FIX A-01]** Cancel-restock moved **inside** the order-update transaction and gated on `enforceStock`. **[FIX A-03]** |
| Connection lifecycle | **PASS** | `src/lib/db.ts` — PrismaClient singleton on `globalThis` (no per-request clients); serverless-safe |
| Neon pooling | **PASS** (documented) | `DATABASE_URL` = Neon **pooled** URL for runtime; `DIRECT_DATABASE_URL` (direct) used only by CLI schema ops with pooled fallback (`scripts/prisma-deploy-db.cjs`). `sslmode=require` in both. Prisma 6 supports PgBouncer-style pooled URLs for normal queries. |

## 4. Environments / configuration / secrets

| Item | Status | Evidence |
|---|---|---|
| Env separation Preview vs Production | **BLOCKED** (dashboard access) | cannot verify Vercel project settings from the sandbox. Required setup documented in `docs/ENVIRONMENT_VARIABLES.md` + RUNBOOK §3. Code side is correct: all secrets server-only. |
| Secret exposure in code | **PASS** | full `process.env` inventory: only `APP_URL`/`NEXT_PUBLIC_*` (non-secret), `SESSION_COOKIE_SAMESITE`, `NODE_ENV`, `TELEGRAM_*` (in `server-only` modules), `DATABASE_URL` (Prisma engine only). No NEXT_PUBLIC secret, no JWT. |
| Secret exposure over API | **PASS** | `/api/webmaster/telegram/config` returns masked values only (`telegram-config.ts` `maskToken/maskChatId`); delivery log `target` stores masked chat id; verified by test I-7/I-10. |
| `.env.example` accuracy | **PASS** | ships in ZIP; matches `ENVIRONMENT_VARIABLES.md`. |
| Demo credentials risk | **PASS** (documented) | seed creates `owner@maisonelan.dev / Maison2025!` — seed only runs on an **empty** DB (guard in `prisma/seed.ts`), and SECURITY.md + RUNBOOK instruct rotation/`/webmaster/setup` usage on real installs. |

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
| Owner bootstrap | **PASS** (fixed) | `/api/webmaster/setup` only usable while 0 OWNERs; check+create now share one transaction (TOCTOU window closed on SQLite, narrowed on Postgres). **[FIX A-08]** |
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

Isolation: throwaway SQLite DB in `os.tmpdir()` (schema pushed per run, file deleted after), `next/headers` cookie-jar mock, fetch stubbed (no network). **26 tests / 77 assertions, all passing.** Type-checked as part of the main tsconfig (see FIX A-10).

| # | Invariant | Tests |
|---|---|---|
| I-1 | Client prices cannot override server totals | 2 |
| I-2 | Concurrent checkouts cannot oversell | 1 |
| I-3 | Repeated/concurrent checkout → no duplicate orders | 2 |
| I-4 | Customers cannot read/see others' orders (API + success page) | 5 |
| I-5 | Unauthorized users cannot execute webmaster actions | 5 |
| I-6 | Invalid status transitions rejected, no write | 2 |
| I-7 | Telegram failure never rolls back an order; masked config only | 2 |
| I-8 | DB errors → controlled messages, no secret leakage | 3 |
| I-9 | Notification config isolation (env vs DB precedence) | 2 |
| I-10 | Public/staff responses expose no private data | 3 |

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
| A-05 | **High** | Zero automated tests | new `tests/invariants.test.ts` (26 tests) + `bun run test` | 26/26 ✅ |
| A-06 | Medium | No `not-found`/`error`/`global-error` boundaries | branded pages added | manual |
| A-07 | Medium | `SECURITY.md` documented a nonexistent `/api/upload` route (overstated controls) | corrected: uploads not implemented; images by URL | doc review ✅ |
| A-08 | Medium | Owner-bootstrap TOCTOU (count-then-create race) | check+create in one transaction | code review ✅ |
| A-09 | Low | Checkout idempotency fallback (`Date.now()+Math.random`) violated the UUID schema → latent 422 | RFC-4122 v4 fallback via `crypto.getRandomValues` | code review ✅ |
| A-10 | **High** | `tests/` is inside the Next tsconfig include scope (`**/*.ts`); with `ignoreBuildErrors: false` (A-04) the 16 type errors in the new test file (untyped `bun:test` module, `Route` handler type rejecting concrete args, `RequestInit` nullability, `fetch`-stub casts under bun-types) would have **broken the Vercel build** | targeted type fixes only, zero behavior change: `/// <reference types="bun-types" />`, `Route` args `never[] \| unknown[]`, narrowed `req()` init, real `TelegramConfigStatus` type import, fetch stubs cast via `unknown` | `tsc --noEmit` fully clean incl. tests/ ✅ · 26/26 tests re-run ✅ · lint ✅ |

## 12. Accepted risks (documented, explicitly accepted)

| ID | Risk | Rationale / mitigation |
|---|---|---|
| R-1 | In-memory rate limiter (single-process) | current scale = single Vercel function region; swap Map→Redis when multi-instance |
| R-2 | `prisma db push` instead of migration history | deliberate for this white-label product; destructive pushes fail the build; RUNBOOK documents forward-fix + restore |
| R-3 | SMTP not integrated for password reset | dev-only token exposure (`NODE_ENV` gate); integrate a provider before allowing self-serve resets in production (admin-assisted reset via SQL tool `hash:password` documented) |
| R-4 | No CSP yet | needs an inline-nonce pass over Next's bootstrap; scheduled hardening, non-blocking |
| R-5 | Dependency vulnerability scan unavailable in sandbox | enable Dependabot/osv-scanner in CI on first GitHub push |
| R-6 | Preview/Prod env separation not verifiable from sandbox | RUNBOOK §3 gives the exact expected Vercel configuration to apply/verify manually |

## 13. Release verdict

> ### **READY WITH ACCEPTED RISKS**
>
> All release-critical invariants now pass with executable evidence (26 automated tests + lint + tsc + verified seed chain). The remaining risks (R-1…R-6) are documented, bounded, and none is a verified defect. Two BLOCKED items (Vercel build execution, dashboard settings) resolve themselves in the RUNBOOK's preview-deploy step and carry an explicit verification checklist.
>
> Final verification pass re-ran every gate after FIX A-10 (a stale tsc claim that would have broken the Vercel build) — all green. **Verdict unchanged.**
>
> **Do not deploy straight to Production.** Follow RUNBOOK §4: deploy to **Preview** first, run the smoke checklist, then promote.

**Next safest action:** push this build to Vercel as a **Preview** deployment with the env matrix from `docs/ENVIRONMENT_VARIABLES.md`, execute RUNBOOK §4 smoke tests, then promote to Production.
