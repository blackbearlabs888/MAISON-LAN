# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); this project does not yet use semantic versioning for public releases.

## [0.4.1] — Audit reconciliation: dependency scan → 0 vuln, owner-takeover hardening, baseline drift check

The release-gate review of the v0.4.0 audit found document inconsistencies (conflicting test counts), an un-executed dependency scan (BLOCKED), and two unproven security claims (owner bootstrap on Postgres, auto-baseline validity). Everything that could be verified inside the sandbox is now verified with executable evidence; everything that cannot is marked pending Preview. Full evidence: `docs/PRODUCTION_READINESS_AUDIT.md` §11 (C-01…C-05) + §14 (release validation gates).

### Security
- **C-02 (high) — owner-takeover path closed:** seed no longer re-creates missing demo users once any user exists. Previously, a buyer who deleted `owner@maisonelan.dev` (or renamed their account) silently got it back — with its publicly documented password — on the next deploy. Demo users are now created **only on an empty users table** (fresh demo install); existing demo accounts keep the invalid-hash self-heal and the explicit `SEED_FORCE=1` repair. Proven by new I-11 cases (populated DB ⇒ zero users created; fresh empty DB ⇒ 3 demo users).
- **C-03 (high) — owner bootstrap race on PostgreSQL closed:** the A-08 transaction only serialized bootstraps on SQLite (single writer); under Postgres READ COMMITTED two concurrent first-run submissions could both observe `ownerCount === 0` and create two OWNER accounts. `/api/webmaster/setup` now takes a transaction-scoped `pg_advisory_xact_lock(742191117)` on Postgres; the loser re-reads the count and gets 409.
- **C-01 (critical) — dependency vulnerabilities 24 → 0:** first real scan (`npm audit --omit=dev`) found **2 critical** (`next` Image-Optimizer DoS + HTTP deserialization, `next-auth` email-normalizer bypass) and 14 high. Remediation: `next ^16.4.2`, `next-auth ^4.24.15`, `next-intl ^4.14.9`, `uuid ^11.1.1`, `sharp ^0.35.5`, `prisma`/`@prisma/client` pinned `6.12.0` (below the 6.13.0-dev…7.10.0 advisory range), `overrides: { "defu": "^6.1.7" }`; orphan dependencies `@mdxeditor/editor` and `react-syntax-highlighter` **removed** (imported nowhere in `src/`); `bun.lock` + generated `package-lock.json` shipped. Re-scan: **0 vulnerabilities**.

### Fixed
- **C-04 (high) — auto-baseline could mark a wrong schema as valid:** the baseline trigger matched broad phrases (`already exists` also appears in unrelated failures), and baselining only fixes migration *history*. `scripts/prisma-deploy-db.cjs` now (a) triggers a baseline **only** on the official P3005 signature, and (b) runs a **Step 1b drift check** (`prisma migrate diff --from-url … --to-schema-datamodel --script`) after provisioning — any live-vs-shipped schema difference **fails the deploy** with remediation steps (`SKIP_DRIFT_CHECK=1` is the documented escape hatch; a tool failure degrades to a loud warning, never a false PASS). The shipped `0_init` was additionally proven byte-identical to a fresh regeneration from the datamodel.
- **C-05 (low):** the `prisma-deploy-db.cjs` connection-string hint said "ends with `?pgbouncer=true`" — dropping `sslmode=require`. Corrected to `?sslmode=require&pgbouncer=true`; full Neon guidance re-verified against the shipped stack (Prisma 6.12.0, prisma-client-js, no driver adapters).

### Tests
- Suite grown 33 → **34 tests / 129 assertions** (the single authoritative result; the v0.4.0 addendum's "28 tests / 90 assertions" was a stale historical snapshot). New coverage: S-01 resurrection ban on a populated DB, fresh-install CLI subprocess on an empty throwaway DB (creates 3 demo users, second run inert), plus all prior invariants re-verified on the upgraded dependency set (Next 16.4.2, Prisma 6.12.0).

### Docs
- `docs/PRODUCTION_READINESS_AUDIT.md`: reconciled to one final test count; dependency scan un-blocked with evidence; new §14 **Release Validation Gates** (4/7 verified from the sandbox; fresh-Neon install, env isolation, live-PG drift/concurrency runs pending the Preview deployment); verdict restated as **READY FOR PREVIEW VALIDATION — production-ready claim is NOT yet earned**.
- `SECURITY.md`: seed/demo-credential guidance rewritten around the S-01 rule and the `SEED_FORCE` footgun.

## [0.4.0] — Deterministic database bootstrap: migrations + seed v2 + verified deploys

Field report from the first real deploy — *“seed tidak masuk database, dashboard webmaster: Something went wrong. Please try again.”* — exposed four provisioning-chain defects. The whole bootstrap was rebuilt so a deploy can no longer succeed while silently producing an empty/broken store. Full evidence: `docs/PRODUCTION_READINESS_AUDIT.md` §0/§11 (B-01…B-07).

### Fixed
- **B-02 (critical)** `[prisma-deploy-db]` no longer skips provisioning silently on Vercel when `DATABASE_URL` is missing or SQLite: the build **fails** with the exact remediation steps (was: warn + exit 0 → “successful” deploy with zero tables → generic 500 on every webmaster API).
- **B-03 (critical)** Seed v2 removes the global skip guard (`users>0 → skip everything`) that left a database with stray rows (manual SQL import) live with an empty catalog. New semantics: **ensure-exists per natural key** — fills every missing row (email/slug/SKU/courier code), never deletes, never overwrites admin-owned rows.
- **B-04 (high)** Seed failure now **fails the build** (was warn + exit 0). Escape hatch: `SKIP_SEED=1` for real stores that bootstrap via `/webmaster/setup`.
- **B-05 (high)** Version-controlled migration history shipped: `prisma/migrations/0_init` (25 tables) + `migration_lock.toml`; the deploy chain is now `prisma migrate deploy` with **automatic baselining** for databases whose tables pre-date migration tracking (P3005/“already exists” → `migrate resolve --applied 0_init` → retry — no data touched). `db push` demoted to an emergency repair tool (`db:push:pg`). Risk R-2 from the v0.3.0 audit is **resolved**.
- **B-06 (medium)** `P1012` (missing/invalid database env var at runtime) now maps to an actionable UI message instead of the generic “Something went wrong.” fallback; empirically verified that the runtime resolves only `url` (`DIRECT_DATABASE_URL` is CLI-only).
- **B-07 (low)** Self-healing demo accounts: an invalid bcrypt hash on a documented demo account (external SQL-dump damage) is repaired automatically on every deploy so the documented logins always work; `SEED_FORCE=1` additionally resets demo passwords and restores canonical demo fields on demand.
- **B-01 (critical, regression)** `.env.example` restored to the working tree (it went missing after the v0.3.0 ZIP was cut).

### Added
- Build-log **verification step**: every deploy ends with `[seed:verify]` per-table row counts — proof in the log that the database actually contains data; `users==0`/`products==0` after seeding fails the build.
- `tests/invariants.test.ts` extended: 26 → **33 tests / 125 assertions** — new suite I-11 (seed fills exactly once; idempotent re-run; ensure mode never overwrites admin rows; force repairs; broken hashes self-heal; never deletes non-seed rows; verify flags an empty catalog and seed self-repairs it) + P1012 funnel mapping case.
- Scripts: `db:migrate:deploy`, `db:migrate:status`, `db:baseline`, `db:reset:sqlite`, `db:seed:force`, `db:verify` (footgun scripts `db:migrate`/`db:reset` removed — they targeted the SQLite schema with a Postgres migrations folder).
- New env vars documented: `SKIP_SEED`, `SEED_VERIFY_ALLOW_EMPTY`; `SEED_FORCE` semantics redefined as *repair* (v0.3.0: fill-missing).

### Docs
- `docs/PRODUCTION_READINESS_AUDIT.md`: Task 26 addendum with the Phase 1 database-state classification (scenarios A–D) and the new evidence log.
- `docs/DEPLOYMENT-VERCEL.md`, `docs/DATABASE.md`, `docs/INSTALLATION.md`, `docs/ENVIRONMENT_VARIABLES.md`, `docs/TROUBLESHOOTING.md`: migration workflow, auto-baseline behavior, and a rewritten troubleshooting entry for the empty-seed incident.


## [0.3.0] — Production readiness audit: security fixes + invariant test suite

### Security / correctness fixes (full evidence in `docs/PRODUCTION_READINESS_AUDIT.md`)
- **A-01 (critical)** Oversell window on Postgres closed: checkout stock deduction is now an **atomic conditional decrement** (`updateMany where stock >= qty`) inside the order transaction — two concurrent checkouts can never both succeed, valid under SQLite and Postgres READ COMMITTED.
- **A-02 (high)** `/checkout/success/[orderNumber]` now enforces ownership: registered orders require the signed-in owner, guest orders require the matching `?email=` (checkout redirect carries it). Order contents were previously viewable by anyone holding the 6-hex order number.
- **A-03 (high)** Cancel-restock moved **inside** the status-change transaction and gated on `enforceStock` — no more stock inflation in enforceStock-off stores and no partial-restock drift.
- **A-04 (high)** `typescript.ignoreBuildErrors` turned **off** — type errors now fail builds (tsc is clean).
- **A-10 (high)** Test suite type-checked & build-safe: the test file's 16 type errors (caught on re-verification) would have failed the Vercel build under A-04's strict gate. `tsc --noEmit` is now fully clean incl. `tests/`; zero behavior change (26/26 tests still pass).
- **A-06** Branded `not-found.tsx` / `error.tsx` / `global-error.tsx` error boundaries replace framework defaults.
- **A-08** Owner-bootstrap (`/api/webmaster/setup`) count+create now share one transaction (TOCTOU window closed on SQLite).
- **A-09** Checkout idempotency-key fallback now generates a valid RFC-4122 v4 UUID (old fallback could 422).
- Security response headers added (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`); `X-Frame-Options` deliberately omitted for preview-panel embedding (documented).
- `SECURITY.md` corrected: the documented `/api/upload` route **does not exist** in this build; secrets storage description updated to DB-first reality.

### Added
- **Automated invariant test suite** (`tests/invariants.test.ts`, `bun run test`): 28 tests / 90 assertions covering the 10 release-critical business invariants (server-side pricing, oversell protection, checkout idempotency, order ownership, webmaster authorization matrix, state-machine rejection, Telegram failure isolation, controlled error funnel, notification config isolation, data-exposure controls). Runs against a throwaway temp SQLite DB with mocked `next/headers` and a stubbed network — zero production risk.
- **`GET /api/health` deployment probe** — one public request distinguishes db-unreachable / schema-missing / not-seeded (booleans only, no internals). Smoke-test step #0 in the RUNBOOK.
- **Actionable database error messages**: the API error funnel now maps unreachable DB, missing/outdated schema and PgBouncer prepared-statement conflicts to concrete remediation messages (still zero internal leakage) instead of a generic 500.
- **Neon pooled URL guidance corrected**: `?sslmode=require&pgbouncer=true` is now documented as REQUIRED on the pooled `DATABASE_URL` (`.env.example`, `ENVIRONMENT_VARIABLES.md`, `DEPLOYMENT-VERCEL.md`) — Prisma's prepared statements collide with Neon's PgBouncer under concurrent requests without it (webmaster dashboard symptom).
- TROUBLESHOOTING: new entries "Seed didn't insert anything on a deployed database" (guard skip is by design + reset paths) and "Webmaster dashboard shows Something went wrong" (diagnosis table + `/api/health` triage).
- `docs/PRODUCTION_READINESS_AUDIT.md` — full audit with per-item PASS/FAIL/BLOCKED evidence, defect register, accepted risks, verdict: **READY WITH ACCEPTED RISKS**.
- `docs/DEPLOYMENT_RUNBOOK.md` — deploy/smoke/backup/rollback/monitoring procedures.
- `docs/ENVIRONMENT_VARIABLES.md` — every env var: purpose, required environments, secret flag, fallbacks (no values).

### Verified
- Seed runs through package.json in all three paths: `bun run db:seed`, `prisma db seed` (uses the `prisma.seed` config — the Vercel deploy path), and empty-DB full seed via `db push` + seed (row counts exact; owner hash 60 chars, login-viable; re-run safely skipped).

## [0.2.2] — Auto-provision on deploy: schema push + seed

### Added
- **Deployments provision their own database**: the Vercel build now runs `prisma db push` (syncs the 25-table schema to Neon) and seeds demo content automatically — a fresh deploy no longer ships an empty store.
- `scripts/prisma-deploy-db.cjs` build helper: Postgres/SQLite context detection (mirrors `prisma-generate.cjs`), `DIRECT_DATABASE_URL` → `DATABASE_URL` pooled fallback for schema ops, runner candidates (prisma → npx → bunx).
- Seed guard: `prisma/seed.ts` seeds **only an empty database**; redeploys never overwrite existing users/products/admin-edited content. `SEED_FORCE=1` env opts out of the guard.
- New script `db:seed:pg` + `prisma.seed` package.json config (enables `prisma db seed` / auto-seed on `migrate reset`).
- Admin utility `bun run hash:password "…"` (`scripts/hash-password.cjs`): prints a self-verified 60-char bcrypt hash for fixing manually-inserted users whose `passwordHash` is a placeholder ("Invalid email or password" for every password). Documented in both troubleshooting guides.
- **SQL seed for the Neon SQL Editor** (`prisma/seed.sql`, download `/maison-elan-seed.sql`): the full demo dataset as plain PostgreSQL — real bcrypt hashes, `ON CONFLICT DO NOTHING` idempotency, optional commented WIPE block. Generated by `scripts/generate-seed-sql.cjs` (`bun run seed:sql`) from the official seed inside a throwaway database; round-trip verified (104 statements, 13 tables, hash login-viability, re-run idempotency).

### Fixed
- `.env.example` restored (went missing from the release ZIP again); now documents `SEED_FORCE`, SQLite relative-path resolution (`file:../db/custom.db`) and the pooled/direct Neon pair.
- Deployment guide: first-run flow now covers the auto-seeded branch, demo-account credentials corrected to the actual seed output, troubleshooting rows for empty stores / seed guard / push failures.

## [1.0.0] — Initial commercial release

First complete build of the MAISON ÉLAN white-label premium e-commerce platform.

### Added — Storefront
- Editorial homepage: hero carousel (banners), category grid, new arrivals, best sellers, editorial section — each toggleable from settings.
- Catalog with filtering (category, price), search, sorting and pagination.
- Product detail pages: image gallery, size/color variant picker with per-variant SKU, stock and price deltas, sale prices, related products.
- Category collection landing pages (`/collections/[slug]`).
- Cart (Zustand, persisted to localStorage) with server-side re-validation at checkout.
- Checkout: server-computed pricing and shipping quotes by province, idempotent order creation, guest or logged-in purchase, address saving.
- Order success page and public order tracking (`/track`, order number + email).
- Customer accounts: register, login, profile, change password, address book, order history with detail and status timeline.
- CMS content pages (sanitized Markdown), FAQ page, newsletter signup, password reset flow.
- SEO: settings-driven metadata, Open Graph, sitemap, robots.

### Added — Webmaster dashboard (`/webmaster`)
- First-owner bootstrap at `/webmaster/setup` (only while zero OWNER accounts exist).
- Role-based access: OWNER, ADMIN, ORDER_MANAGER, CONTENT_MANAGER — enforced server-side per API route.
- Dashboard KPIs: revenue trend chart, best sellers, low-stock list, recent orders, Telegram health.
- Orders: list/detail, status machine transitions, payment confirmation with reference, admin notes, shipment management, status history.
- Products: editor with image uploads (max 8), variants, categories, sale pricing, flags, archive.
- Categories, banners (with scheduling fields), CMS pages, FAQ — full CRUD.
- Customers: list, detail, enable/disable.
- Shipping: couriers (code, tracking-URL template, lead times) and rates (FLAT/REGION, free-above threshold).
- Settings: tabbed editor for all white-label configuration (brand, homepage, commerce, operations, payment, contact, navigation, SEO).
- Notifications: Telegram configuration status, "Send test notification", delivery log with counters.
- Audit log of sensitive admin actions.

### Added — Platform
- Prisma schema with 24 models (identity, catalog, orders, shipping, CMS, notifications, audit).
- Money stored as integer minor units (cents) everywhere.
- Custom auth: bcryptjs hashing, opaque DB-backed session tokens, HttpOnly cookies (30-day TTL).
- In-memory rate limiting on login, register, forgot/reset password, checkout, track, newsletter, owner bootstrap.
- Zod validation on every API route; order-status legal-transition map.
- Telegram notification engine: 9 event types, delivery log with 3 retries + backoff, fire-and-forget (never blocks orders), env-only credentials.
- Upload API with magic-byte sniffing (JPEG/PNG/WebP, 5 MB cap) writing to `public/uploads/`.
- Development seed: 14 products, 5 categories, 3 couriers with rates, 2 banners, 7 CMS pages, FAQ, demo accounts (dev-only credentials).
- Documentation suite under `docs/` and root (`README.md`, `SECURITY.md`, etc.).
- Idempotent `prisma/seed.ts` (safe to re-run).

### Decisions
- SQLite via Prisma for this build (portable to PostgreSQL by switching the datasource provider — documented).
- No Vitest/Playwright in this build environment (sandbox restriction, D-06); quality gated by ESLint, headless-browser E2E verification and documented manual test procedures.
- CMS rendered as sanitized Markdown (no raw HTML) — XSS eliminated by construction (D-07).
- Telegram credentials via environment variables only (D-05).
- Staff account creation via database tooling in v1 (no UI) — documented honestly.
