# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); this project does not yet use semantic versioning for public releases.

## [0.2.2] — Auto-provision on deploy: schema push + seed

### Added
- **Deployments provision their own database**: the Vercel build now runs `prisma db push` (syncs the 25-table schema to Neon) and seeds demo content automatically — a fresh deploy no longer ships an empty store.
- `scripts/prisma-deploy-db.cjs` build helper: Postgres/SQLite context detection (mirrors `prisma-generate.cjs`), `DIRECT_DATABASE_URL` → `DATABASE_URL` pooled fallback for schema ops, runner candidates (prisma → npx → bunx).
- Seed guard: `prisma/seed.ts` seeds **only an empty database**; redeploys never overwrite existing users/products/admin-edited content. `SEED_FORCE=1` env opts out of the guard.
- New script `db:seed:pg` + `prisma.seed` package.json config (enables `prisma db seed` / auto-seed on `migrate reset`).
- Admin utility `bun run hash:password "…"` (`scripts/hash-password.cjs`): prints a self-verified 60-char bcrypt hash for fixing manually-inserted users whose `passwordHash` is a placeholder ("Invalid email or password" for every password). Documented in both troubleshooting guides.

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
