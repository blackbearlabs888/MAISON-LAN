# MAISON ÉLAN

**A white-label, premium e-commerce platform.** Luxury editorial storefront, customer accounts, a role-based webmaster dashboard, manual (bank-transfer) payments, manual shipment tracking and Telegram operator notifications — all rebrandable at runtime without touching code.

> Everything brand-specific lives in configuration: the `StoreSetting` singleton edited at `/webmaster/settings`, plus a handful of environment variables for secrets. Default branding ("MAISON ÉLAN") is fictional demo content.

---

## Product overview

MAISON ÉLAN is a complete direct-to-consumer commerce system built for boutiques that sell with **manual payment verification** (bank transfer) and **hands-on fulfillment**:

- **Storefront** — editorial homepage, catalog with filters/search/sort, product detail pages with variants and stock, category collections, cart, checkout with server-computed pricing, order confirmation, public order tracking, customer accounts (profile, addresses, order history), CMS pages, FAQ and newsletter capture.
- **Webmaster dashboard** (`/webmaster`) — KPIs, orders, customers, products (images/variants/SKU/stock), categories, banners, CMS pages, FAQ, shipping setup, settings, notification health and an audit log.
- **Manual operations** — payments are verified by a human against bank transfers; shipments are dispatched and tracked manually (no courier APIs), with statuses the operator updates by hand.
- **Telegram notifications** — order/payment/shipment/stock/registration alerts pushed to an operator chat via a bot token held in environment variables only.

## Main features

| Area | Highlights |
|---|---|
| Catalog | Products with image galleries, size/color variants, per-variant SKU + stock, sale prices, featured/new-arrival/best-seller flags, category mapping, archive |
| Checkout | Server-side recomputation of prices/totals/stock (browser is never trusted), idempotency key prevents duplicate orders, transactional stock deduction prevents overselling, shipping rates quoted from DB by province |
| Orders | Status machine with legal-transition enforcement, separate payment status, full status history, payment records with reference, admin notes, guest **and** member checkout |
| Shipping | Courier directory with tracking-URL templates, FLAT and REGION (province-matched) rates, per-rate and store-wide free-shipping thresholds, manual tracking numbers, shipment status history |
| Accounts | bcrypt-hashed passwords, DB-backed opaque session tokens in HttpOnly cookies, 30-day sessions, password reset (token flow), customer disable by staff |
| White-label | Brand name/tagline/logo wordmark, accent color, announcement bar, nav items, footer, homepage section toggles, currency/locale/timezone, order-number prefix, payment instructions — all editable at `/webmaster/settings`, no redeploy |
| CMS | Markdown content pages (sanitized render), FAQ entries, promotional banners with scheduling window |
| Ops | Role-based access (OWNER/ADMIN/ORDER_MANAGER/CONTENT_MANAGER), audit log of sensitive actions, Telegram delivery log with retries, low-stock alerts, maintenance mode |
| SEO | Per-page metadata from settings, Open Graph, `sitemap.ts`, `robots.ts` |
| Security | Zod validation on every API route, server-side role checks everywhere, rate limiting on sensitive endpoints, upload magic-byte sniffing, secrets only in env |

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) | `output: "standalone"` build |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) | theme via CSS variables; accent driven by settings |
| Database | SQLite via Prisma ORM 6 | portable — one-line datasource swap to PostgreSQL (see below) |
| Auth | Custom: bcryptjs + opaque DB session tokens | HttpOnly, SameSite=Lax, Secure in production |
| Validation | Zod v4 on every API route | status enums validated as strings (SQLite has no enums) |
| Client state | Zustand (cart, persisted to localStorage) | server always re-prices the cart |
| Notifications | Telegram Bot API (server-side adapter) | env-only credentials, delivery log with retries |
| Fonts | Cormorant Garamond (display) + Jost (sans) via `next/font/google` | OFL-licensed |
| Images | Local disk `public/uploads` behind `/api/upload` | swap the adapter for S3 (see below) |
| Runtime | Node.js 20+ or Bun 1.x | scripts in `package.json` are Bun-flavored but Node-compatible |

## Prerequisites

- **Node.js 20+** or **Bun 1.x** (Bun recommended — scripts and `db:seed` use `bun`).
- SQLite ships bundled with Prisma — **no database server to install**.
- Outbound network access only if you enable Telegram notifications.

## Quick start

```bash
# 1. Install dependencies
bun install

# 2. Configure the environment
cp .env.example .env
#    → edit .env: DATABASE_URL is required; Telegram vars are optional

# 3. Create the SQLite database from prisma/schema.prisma
bun run db:push

# 4. Seed demo data (categories, 14 products, couriers, CMS pages, dev accounts)
bun run db:seed

# 5. Start the dev server
bun run dev

# 6. Open the store
#    Storefront:  http://localhost:3000
#    Webmaster:   http://localhost:3000/webmaster
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Prisma connection string. SQLite default: `file:./db/custom.db`. For PostgreSQL: `postgresql://user:pass@host:5432/db` |
| `APP_URL` | — | Public base URL used in Telegram messages (dashboard deep-links). Falls back to `http://localhost:3000`. Set it in production (e.g. `https://your-store.com`) |
| `TELEGRAM_BOT_TOKEN` | — | Bot token from [@BotFather](https://t.me/BotFather). Enables notifications |
| `TELEGRAM_CHAT_ID` | — | Target chat/group id for notifications |

**Secrets live only in environment variables — never in the database, never in `StoreSettings`, never in client code.** The Telegram token is never rendered back to any UI (the dashboard shows a masked chat id only).

## First-owner setup

Two supported paths:

1. **Production path — owner bootstrap.** Open `http://localhost:3000/webmaster/setup` (or `/webmaster` — you will be redirected) while **no OWNER account exists**. The bootstrap form creates exactly one OWNER and signs you in. It is permanently disabled once an owner exists. No default credentials ship with the product.
2. **Development path — seed credentials.** `bun run db:seed` creates documented demo accounts (below). **Dev/demo only.**

## Dev credentials

> ⚠️ **DEV ONLY — NEVER USE IN PRODUCTION.** These accounts exist because `bun run db:seed` ran. In a production install, do not seed; use `/webmaster/setup` instead, and create further staff accounts directly in the database (see `docs/WEBMASTER-GUIDE.md`).

| Role | Email | Password |
|---|---|---|
| OWNER | `owner@maisonelan.dev` | `Maison2025!` |
| ORDER_MANAGER | `orders@maisonelan.dev` | `Staff2025!` |
| CUSTOMER | `customer@example.com` | `Customer2025!` |

## Scripts

All commands match `package.json` exactly:

| Script | Command | What it does |
|---|---|---|
| `bun run dev` | `next dev -p 3000 2>&1 \| tee dev.log` | Dev server on port 3000 (logs to `dev.log`) |
| `bun run build` | `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/` | Production build into a standalone server bundle |
| `bun run start` | `NODE_ENV=production bun .next/standalone/server.js 2>&1 \| tee server.log` | Runs the standalone production server (logs to `server.log`) |
| `bun run lint` | `eslint .` | ESLint over the repo — the shipped quality gate |
| `bun run db:push` | `prisma db push --accept-data-loss` | Sync `prisma/schema.prisma` → database (dev workflow) |
| `bun run db:generate` | `prisma generate` | (Re)generate the Prisma client after schema edits |
| `bun run db:migrate` | `prisma migrate dev` | Create/apply local migrations (recommended for production schema changes) |
| `bun run db:reset` | `prisma migrate reset` | Drop & recreate DB, re-apply migrations (`--skip-seed` not set — will prompt) |
| `bun run db:seed` | `bun prisma/seed.ts` | Idempotent demo seed (safe to re-run) |

## White-label branding guide

Rebrand without touching code, at **`/webmaster/settings`** (OWNER/ADMIN):

- **Brand** — store name, tagline, logo wordmark or logo image URL, accent color (`primaryColor`, hex — drives the `--brand-accent` CSS variable storefront-wide), announcement bar text/toggle.
- **Homepage** — hero headline/subline, toggles for categories / new arrivals / best sellers / editorial sections.
- **Navigation** — header nav items (label + href), footer about text.
- **Locale/commerce** — currency (ISO 4217), locale, timezone, order-number prefix (e.g. `ME-2601-A1B2C3`).
- **Contact/SEO** — contact email/phone/address, social links, SEO title/description, OG image.

Full field reference with effects: [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md). Developer-level customization (fonts, palette, new sections): [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md).

## Switching SQLite → PostgreSQL

The schema is deliberately portable; money is stored as **integer cents** (no DECIMAL dependency), so the switch is safe.

1. In `prisma/schema.prisma`, change the datasource provider:

   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

2. Point `DATABASE_URL` at your PostgreSQL instance in `.env`.
3. Recreate the schema and (optionally) re-seed:

   ```bash
   bun run db:push     # or bun run db:migrate for a migration history
   bun run db:seed     # demo data only — skip for a real store
   ```

That's the whole migration. Status "enums" are validated strings and JSON blobs are stored in `String` columns, both of which work unchanged on PostgreSQL. See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for production notes.

## Image storage

- Product/category/banner images are uploaded via `POST /api/upload` (staff-only), validated by **magic-byte sniffing** (JPEG/PNG/WebP, 5 MB cap) and written to **`public/uploads/`**, served at `/uploads/<file>`.
- Shipping the app with `output: "standalone"` copies `public/` into the bundle at build time; uploaded files persist in `public/uploads` next to the running server.
- To move to object storage (S3/R2/Cloudinary), replace the two `fs/promises` calls in `src/app/api/upload/route.ts` with your SDK and return the public URL — the rest of the app stores plain URLs and needs no other changes.

## Telegram setup

See **[`docs/TELEGRAM-SETUP.md`](docs/TELEGRAM-SETUP.md)** for the full walkthrough (create bot → get chat id → set env vars → restart → "Send test notification" at `/webmaster/notifications`). Events covered: `ORDER_CREATED`, `PAYMENT_CONFIRMED`, `ORDER_CANCELLED`, `SHIPMENT_ADDED`, `SHIPMENT_STATUS_CHANGED`, `LOW_STOCK`, `NEW_REGISTRATION`. Delivery is logged with 3 retries + backoff and **never blocks or breaks an order**.

## Documentation index

| Document | Contents |
|---|---|
| [`docs/INSTALLATION.md`](docs/INSTALLATION.md) | Fresh install, step by step, verification checklist |
| [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) | Every settings field + env vars, effects |
| [`docs/WEBMASTER-GUIDE.md`](docs/WEBMASTER-GUIDE.md) | Operator manual per role, daily order workflow |
| [`docs/SHIPPING-SETUP.md`](docs/SHIPPING-SETUP.md) | Couriers, rates, free-shipping thresholds, manual tracking |
| [`docs/TELEGRAM-SETUP.md`](docs/TELEGRAM-SETUP.md) | Bot creation, chat id, event list, reliability |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Full data-model reference (all Prisma models) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, request flow, order lifecycle |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture decision log (D-01 … D-10) |
| [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md) | Developer white-label & extension guide |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | VPS/managed deployment, standalone build, migrations |
| [`docs/BACKUP-RESTORE.md`](docs/BACKUP-RESTORE.md) | SQLite/PostgreSQL + media backup and restore |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Common issues and fixes |
| [`docs/TESTING.md`](docs/TESTING.md) | Quality gates, manual smoke script, curl test procedures |
| [`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md) | Pre-release gates |
| [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) | What shipped, quality gates executed |
| [`docs/PHASE-LOG.md`](docs/PHASE-LOG.md) | Per-phase build log |
| [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md) | Honest limitations of this build |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history |
| [`SECURITY.md`](SECURITY.md) | Reporting vulnerabilities, security features |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Branches, commits, PR rules |

## Known limitations

Summarized here, detailed in [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md):

1. No automated Vitest/Playwright suites in this build (sandbox restriction, decision D-06) — quality gated by lint + documented manual/browser test scripts.
2. SMTP/email not integrated — password reset returns the raw token **only in non-production**; production installs must wire an email provider at `src/app/api/auth/forgot-password/route.ts`.
3. SQLite is single-writer at a time — fine for boutique traffic; PostgreSQL recommended for high-traffic stores.
4. Staff account creation has no UI (by design for v1) — done via the database/Prisma Studio.
5. Telegram requires network egress + valid env credentials; failures are logged and never block orders.
6. Money is integer cents; prices are entered in currency units in the UI and converted once (no multi-currency pricing).

## License

Commercial license — see [`LICENSE`](LICENSE). **Note:** the license file ships with a clearly marked TODO section the purchaser must finalize before resale/deployment, including a review of third-party MIT dependencies (Next.js, React, Prisma, Tailwind CSS, shadcn/ui, bcryptjs) and OFL-licensed Google fonts.
