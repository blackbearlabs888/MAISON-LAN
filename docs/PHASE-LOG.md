# PHASE LOG

Per-phase build log for this repository. Consolidated at documentation time from the engineering worklog (`worklog.md`) and verified against the source tree; commands listed are the ones used during the build. Every claim here is checkable in the cited files.

> Verification tooling in this sandbox: ESLint + headless-browser E2E (agent-browser). No Vitest/Playwright (sandbox forbids test code — decision **D-06**).

---

## Phase 0 — Audit, architecture, schema, docs

**Implemented**
- Stack lock: Next.js 16 App Router, React 19, TS strict, Tailwind 4 + shadcn/ui (New York), Prisma 6 + SQLite, custom cookie auth (bcryptjs), Zod v4.
- Full Prisma schema — 24 models: User, Session, PasswordResetToken, Address, StoreSetting, Category, Product, ProductImage, ProductVariant, ProductCategory, Order, OrderItem, OrderStatusHistory, PaymentRecord, Courier, ShippingRate, Shipment, ShipmentStatusHistory, Banner, ContentPage, FaqEntry, NewsletterSubscriber, NotificationDelivery, AdminAuditLog.
- Decision log D-01…D-10 (SQLite portability, integer-cents money, custom auth over NextAuth, client cart + server re-pricing, env-only Telegram, no test runner, sanitized Markdown CMS, owner bootstrap, idempotent checkout, local storage adapter).

**Key files:** `prisma/schema.prisma`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`.

**Commands:** schema designed; `bun run db:push` (initial DB creation), `bun run db:generate`.

**Result:** DB file `db/custom.db` created; schema in sync. No defects.

---

## Phase 1 — Core platform

**Implemented**
- `src/lib/db.ts` (Prisma singleton), `src/lib/auth.ts` (bcrypt cost 10, opaque 32-byte session tokens SHA-256-hashed at rest, cookie `me_session` HttpOnly/SameSite=Lax/Secure-in-prod, 30-day TTL, `requireUser/requireRole`, `audit()`).
- `src/lib/permissions.ts` (OWNER `*`; ADMIN all; ORDER_MANAGER: orders/customers/shipping/notifications/audit; CONTENT_MANAGER: products/categories/banners/pages/faq).
- `src/lib/validators.ts` (Zod schemas for every route; `ORDER_TRANSITIONS` legal-move map), `src/lib/api-helpers.ts` (typed ok/fail/handleError, `clientIp`), `src/lib/rate-limit.ts` (in-memory buckets).
- `src/lib/store-settings.ts` (`StoreSettings` shape, `DEFAULT_SETTINGS`, deep-merge loader, upsert saver), `src/lib/money.ts` (integer-cents format/parse).
- Storefront shell: header (wordmark/announcement/nav), footer (contact/social/newsletter/CMS links), maintenance gate.

**Commands:** `bun run db:push` (settings/auth tables), `bun run lint` → PASS.

**Result:** core compiles clean; auth verified manually at this stage. No defects.

---

## Phase 2 — Brand assets (worklog Task 2-a)

**Implemented**
- 22 AI-generated images, integrity-checked (PIL): hero/editorial 1440×720 ×3 (`hero-1`, `hero-2`, `editorial-1`), category tiles 1024×1024 ×5, products 1024×1024 ×12 + portrait 864×1152 ×2 — all under `public/images/`.
- One transient API failure (`cat-fragrance`) recovered on retry; final state 22/22 valid.

**Result:** assets ready for seed wiring. No defects.

---

## Phase 3 — Storefront

**Implemented**
- Homepage (`(storefront)/page.tsx`): banners-driven hero carousel, category grid, new-arrival/best-seller rails, editorial section — each flag-gated from settings.
- Catalog `/products` (filters/sort/search/pagination), PDP `/products/[slug]` (gallery, variant picker with stock + price deltas, sale pricing), `/collections/[slug]`.
- Cart (Zustand + localStorage, `src/lib/cart-store.ts`), checkout (address, shipping quotes via `POST /api/shipping/methods`), success page.
- Accounts: register/login/logout/forgot/reset/change-password/profile/addresses/orders + detail.
- CMS `/pages/[slug]` (sanitized Markdown), FAQ, newsletter capture, `/track`, `sitemap.ts`, `robots.ts`.

**Commands:** `bun run db:push` (catalog/content tables), `bun run lint` → PASS, browser smoke of catalog/PDP/cart.

**Result:** storefront browsable end-to-end. No defects.

---

## Phase 4 — Webmaster dashboard (worklog Task 4)

**Implemented**
- Typed API client `src/lib/webmaster-client.ts` (incl. `unitsToCents`/`centsToUnits` money helpers).
- Route structure: guarded `(dashboard)/layout.tsx` + shell with role-filtered nav; `/webmaster/setup` first-owner bootstrap (only while zero OWNERs; rate-limited; audited).
- Pages: dashboard (KPIs, recharts trend, best sellers, low stock, recent orders, Telegram health), orders list/detail (transitions, payment confirm, notes, shipments), products list/editor (uploads, variants, categories), categories, customers (+disable), shipping (couriers + rates), banners, CMS pages/editor, FAQ, settings (tabbed), notifications (status + test + delivery log), audit.
- Webmaster APIs under `src/app/api/webmaster/*` — every handler re-checks role server-side (`requireStaff(capability)`).

**Verification:** anonymous `/webmaster` → 307 to login; staff-only routes render per role; lint PASS.

**Result:** full operator surface working. No defects.

---

## Phase 5 — Checkout & order engine

**Implemented**
- `src/lib/orders.ts`: `quoteShippingRates` (FLAT/`*` + REGION case-insensitive province match; two-level free-shipping logic), `createOrderFromCheckout` (idempotency short-circuit; DB-only pricing with sale-price + variant delta; enforceStock validation; transactional stock re-check + deduction; server-side rate validation; address snapshot; status history "Order created"), `assertTransition`, `generateOrderNumber` (`ME-YYMM-XXXXXX`).
- `POST /api/orders` (rate-limited 10/min, guest or member, `ORDER_CREATED` notify after commit), `GET /api/orders` (own orders only).

**Verification (browser + curl):** golden-path order created; idempotency — same key returns same order, no duplicates; stock guard — 409 and no overselling; fake `shippingRateId` — 400; tampered totals impossible (no price fields accepted).

**Result:** order engine guarantees hold. No defects.

---

## Phase 6 — Manual shipping & tracking

**Implemented**
- Courier/rate management UI + APIs (`/webmaster/shipping`, Zod `courierSchema` with `{trackingNumber}` template enforcement).
- Shipment panel on order detail: create shipment (courier, tracking number, estimate, note → builds tracking URL from template), manual status updates with history.
- Public `/track` (order number + email, rate-limited 20/min) reflecting status + shipment timeline.

**Verification:** seeded couriers (NEX/SWFT/KITA) quote correctly for `DKI Jakarta` and other provinces; tracking page mirrors webmaster updates. No defects.

---

## Phase 7 — Notifications & audit

**Implemented**
- `src/lib/telegram.ts`: 9 event types, queue-then-send (`NotificationDelivery` PENDING first, detached delivery), 3 attempts with 1.5 s×attempt backoff, 10 s timeout, 4xx≠429 fails fast, masked targets only.
- `GET/POST /api/webmaster/telegram/test` (status + real test), notifications page (counters, delivery log), low-stock notifier (threshold-aware), `NEW_REGISTRATION` hook.
- `AdminAuditLog` writes across webmaster mutations; `/webmaster/audit` viewer.

**Verification:** delivery log records TEST/ORDER_CREATED attempts with correct statuses; order flow unaffected when Telegram unconfigured (fire-and-forget). Live delivery not exercised (sandbox egress) — documented honestly in KNOWN-ISSUES.

---

## Phase 8 — QA hardening & documentation

**Implemented**
- Full lint sweep → PASS; manual browser E2E of the golden path (storefront → checkout → order → track → webmaster transitions) → PASS; order-engine security checks (idempotency, stock guard, fake-rate rejection, auth 401s) → PASS (procedures preserved in `docs/TESTING.md`).
- Idempotent seed finalized (`prisma/seed.ts`: settings, 3 dev accounts, 5 categories, 14 products, 2 banners, 3 couriers + rates, 7 CMS pages, 6 FAQ).
- This documentation suite: README + root commercial docs + 18 `docs/` references.

**Commands executed:** `bun run db:push`, `bun run db:seed` (repeated — idempotency verified), `bun run lint`, `bun run dev`, browser verification sessions.

**Result:** release candidate. Unresolved defects: **none** beyond the accepted limitations listed in `docs/KNOWN-ISSUES.md`.
