# KNOWN ISSUES

Honest list of limitations in this build (v1.0.0). None are hidden defects — each is a deliberate scope decision or environmental constraint, with the workaround/upgrade path stated.

## 1. No automated Vitest/Playwright suites in this sandbox build (D-06)

The build environment forbids test code. Quality was gated by `bun run lint`, headless-browser E2E of the golden path, and order-engine security checks (idempotency, stock guard, fake-rate rejection, auth 401s) executed during the build and reproducible via the curl procedures in `docs/TESTING.md` § 3.
**Upgrade path:** § 5 of `docs/TESTING.md` describes exactly where to add Vitest (money/order-lib units) and Playwright (seed → golden path) in a client install.

## 2. SMTP / email not integrated

`POST /api/auth/forgot-password` creates a valid hashed reset token but has no mailer. In **non-production** the raw token is returned in the API response so the flow stays testable; in production it is not. Production installs must integrate an email provider at `src/app/api/auth/forgot-password/route.ts` (send the raw token as a link to `/reset-password?token=…`). Transactional emails (order confirmation, shipping notices) are likewise not sent — order status is communicated via the `/track` page and Telegram (operator-side).

## 3. SQLite single-writer concurrency

SQLite permits one writer at a time. Checkout intentionally keeps its transaction short (stock re-check + deduction only), which is fine for boutique traffic, but heavy concurrent writes can surface `SQLITE_BUSY`, and the in-memory rate limiter assumes a single process.
**Upgrade path:** PostgreSQL — flip `datasource db.provider`, change `DATABASE_URL`, `db:push` (money is integer cents, so no data-format risk); swap the rate-limit Map for Redis behind the same interface (`src/lib/rate-limit.ts`).

## 4. Staff account creation is via DB (no UI) — by design for v1

There is no "add staff user" screen. OWNER/ADMIN/ORDER_MANAGER/CONTENT_MANAGER accounts are created directly in the database (Prisma Studio or SQL) with a bcrypt hash — the honest, documented procedure is in `docs/WEBMASTER-GUIDE.md` § 11. The customer-facing register endpoint can never mint staff roles (role is never accepted from client input).

## 5. Telegram needs network egress and valid env credentials

Delivery requires outbound access to `api.telegram.org` plus a correct `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`. Without them every event is recorded as FAILED ("credentials not configured") in the delivery log — **orders are never blocked or delayed** (queue-then-send, 3 retries, fire-and-forget; `src/lib/telegram.ts`). Live delivery was not exercised in the sandbox (no egress/credentials); the engine, retry behavior and test endpoint are code-verified.

## 6. Sandbox supervisor may restart the dev server during long sessions

The hosting platform's supervisor can restart the dev server/process in this sandbox. All operations are idempotent against this (seed is upsert/skip-based, orders use idempotency keys, settings are singleton upserts), so restarts cause no data corruption — at most an in-flight request is retried.

## Minor notes (accepted)

- `next.config.ts` sets `typescript.ignoreBuildErrors: true` (scaffold default); the lint gate and TS-aware ESLint rules are the shipped quality bar. Production installers may set it to `false` to harden builds.
- `next-auth` and `next-intl` are present in `package.json` from the scaffold but **unused** (custom auth per D-03; UI copy is English-only). Harmless; removable.
- `SHIPPED` order status allows only `COMPLETED` as a forward move — parcel "returns" are modeled on the **shipment** (`RETURNED`) and as a refund at order level, not as an order status.
