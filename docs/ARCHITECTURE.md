# ARCHITECTURE — MAISON ÉLAN White-Label Commerce Platform

## 1. Overview

A white-label, premium e-commerce platform: luxury editorial storefront + customer accounts +
manual-order operations webmaster dashboard + manual shipment tracking + Telegram notifications +
configurable CMS. All brand-specific values live in configuration (DB `StoreSetting` singleton +
environment variables), never in core logic.

## 2. Stack

| Layer      | Choice                                        | Notes |
|------------|-----------------------------------------------|-------|
| Framework  | Next.js 16 (App Router), React 19, TypeScript | strict mode; `output: "standalone"` |
| Styling    | Tailwind CSS 4 + shadcn/ui (New York)         | theme via CSS variables; accent driven by StoreSettings |
| DB         | SQLite via Prisma ORM 6                       | portable: swap `datasource` to PostgreSQL for production (DECISIONS D-01) |
| Auth       | bcryptjs (cost 10) + opaque DB session tokens, HttpOnly SameSite=Lax cookies (`me_session`, 30-day) | DECISIONS D-03 |
| Validation | Zod v4 on every API route                     | never trust client prices/quantities/roles |
| State      | Zustand (cart, client) + server components (catalog/orders) | cart persisted to localStorage |
| Icons      | lucide-react                                  | |
| Images     | `POST /api/upload` → **database** (`MediaAsset` table, magic-byte sniffed, 4 MB cap) → served by `/api/uploads/[id]` | sink adapter in `src/lib/storage.ts` — works on Vercel's read-only FS; swap for S3/Blob without touching routes |
| Notify     | Telegram Bot API via server-side adapter (`src/lib/telegram.ts`) | creds from env only |

## 3. High-level structure

```
src/
  app/
    (storefront)/          # customer-facing; shared header/footer layout (force-dynamic)
      page.tsx             # homepage (banners, categories, new arrivals, best sellers, editorial)
      products/            # catalog + filters + search + sort
      products/[slug]/     # PDP: gallery, variants, stock
      collections/[slug]/  # category landing
      cart/ checkout/      # cart page, checkout, success page
      track/               # public order tracking (order no. + email)
      account/             # profile, addresses, order history & detail
      login/ register/ forgot-password/ reset-password/
      pages/[slug]/        # CMS pages (About, Terms, Privacy, ...)
    webmaster/             # protected admin (OWNER/ADMIN/ORDER_MANAGER/CONTENT_MANAGER)
      layout.tsx           # guard (redirects unauthenticated)
      setup/               # first-owner bootstrap (only while no OWNER exists)
      (dashboard)/         # shell + role-filtered nav
        page.tsx           # KPI overview
        products/ categories/ orders/ customers/ shipping/ banners/ pages/ faq/
        settings/ notifications/ audit/
    api/                   # route handlers; ALL authorization re-checked server-side
  components/{storefront,webmaster}/
  lib/                     # db, auth, permissions, store-settings, money, orders,
                           # telegram, rate-limit, validators, api-helpers,
                           # cart-store, store-config, webmaster-client
prisma/schema.prisma       # all 24 models
docs/                      # this documentation suite
```

## 4. Request & authorization flow

1. Public pages: server-rendered from Prisma. The storefront layout reads settings + session per
   request (`force-dynamic`) so brand changes and maintenance mode apply instantly.
2. Mutations: `POST/PUT /api/*` route handlers → Zod parse → session lookup (DB) → role/ownership
   check → business logic (checkout inside `db.$transaction`) → typed JSON response.
3. Webmaster pages: `webmaster/layout.tsx` guards (redirects unauthenticated); each API handler
   **independently** verifies the role/capability (`requireStaff(capability)` — `src/lib/permissions.ts`).
   UI hiding is never sufficient.
4. Cart is client-side (Zustand + localStorage). Prices/totals/stock are **recomputed on the
   server** at checkout from the database (`src/lib/orders.ts`). The idempotency key (unique
   index) prevents duplicate order submission.

## 5. Order lifecycle

```
PENDING_PAYMENT → PAID → PROCESSING → READY_TO_SHIP → SHIPPED → COMPLETED
        ↘ CANCELLED        (REFUNDED per the transition map; see docs/DATABASE.md §5)
```
- `paymentStatus` (UNPAID / PAID_CONFIRMED / REFUNDED) is modeled **separately** from `status`.
- Every transition appends `OrderStatusHistory` (from, to, actor, note); illegal moves are
  rejected server-side (`ORDER_TRANSITIONS`).
- `Shipment` + `ShipmentStatusHistory` track logistics independently (manual, no courier APIs).
- Order items snapshot name/sku/variant/price/image at purchase time.

## 6. Data model (summary)

User, Session, PasswordResetToken, Address, StoreSetting (singleton JSON), Category, Product,
ProductImage, ProductVariant, ProductCategory (m:n), Order, OrderItem, OrderStatusHistory,
PaymentRecord, Courier, ShippingRate, Shipment, ShipmentStatusHistory, Banner, ContentPage,
FaqEntry, NewsletterSubscriber, NotificationDelivery (Telegram attempts), AdminAuditLog.

Full details: `docs/DATABASE.md` and `prisma/schema.prisma`.

## 7. White-label configuration

- `StoreSetting` singleton (JSON blob) exposed through the typed accessor `src/lib/store-settings.ts`
  with strict defaults and deep-merge on read. Staff edit via `/webmaster/settings` (no redeploy).
- Secrets (DB URL, Telegram bot token / chat id) live **only** in environment variables
  (`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `APP_URL`) — never in the DB, never
  returned to clients. There is no settings-side secret storage by design (DECISIONS D-05).
- Brand accent flows from settings into the `--brand-accent` CSS variable at render time
  (`(storefront)/layout.tsx`); fonts via `next/font` in `src/app/layout.tsx`.

## 8. Security baseline

- bcrypt (cost 10), opaque session tokens (32-byte random, SHA-256-hashed at rest, DB-backed,
  30-day expiry), HttpOnly cookies; `Secure` in production.
- In-memory rate limiting on login (10/min per IP + 8/min per email), register, forgot/reset
  password, checkout, track, newsletter, owner bootstrap (`src/lib/rate-limit.ts`).
- Role checks server-side on every handler; customers restricted to own records.
- Zod schemas for every input; Prisma parameterized queries; CMS rendered as sanitized Markdown
  (react-markdown, no raw-HTML path — D-07).
- Upload validation (5 MB cap, MIME whitelist, magic-byte sniffing, randomized names).
- `AdminAuditLog` records sensitive staff actions.
- Telegram failures are isolated: queue-then-send with 3 retries + backoff, never inside order
  transactions (`src/lib/telegram.ts`).

## 9. Performance / SEO

- Server components; the storefront is intentionally dynamic (settings/session-dependent) so
  white-label changes and the maintenance gate apply on the next request.
- Metadata per page from settings, Open Graph, `sitemap.ts`, `robots.ts`.
- `next/image` with responsive sizes; skeleton loading states; reduced-motion friendly CSS.
