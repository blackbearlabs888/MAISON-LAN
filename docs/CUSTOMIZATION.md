# CUSTOMIZATION — Developer White-Label & Extension Guide

For code-level customization. Operator-level (settings-only) rebranding is covered in `docs/CONFIGURATION.md`. This build's stack: Next.js 16 App Router, Tailwind CSS 4, shadcn/ui, Prisma 6.

## 1. Design tokens

- **Palette / theme**: `src/app/globals.css` defines the shadcn CSS variables (`--background`, `--foreground`, `--primary`, `--radius: 0rem` for the sharp editorial look, `--sale`, chart colors, etc.) under `:root`. Tailwind 4 maps them via `@theme inline` at the top of the file — change values there or add `.dark` overrides; no `tailwind.config` color edits needed.
- **Brand accent**: the storefront wraps its content with an inline style that overrides `--brand-accent` from settings:

  ```tsx
  // src/app/(storefront)/layout.tsx
  <div style={{ "--brand-accent": settings.primaryColor } as React.CSSProperties}>
  ```

  `--brand-accent` defaults to `#9a7b4f` in `globals.css` but always wins from `StoreSettings.primaryColor` (validated `^#[0-9a-fA-F]{6}$`). Use `var(--brand-accent)` in any custom component to stay rebrand-safe.

## 2. Fonts

`src/app/layout.tsx` loads two Google fonts via `next/font` (self-hosted at build time, OFL-licensed):

```tsx
const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["400","500","600","700"] });
const sans    = Jost({ variable: "--font-sans", subsets: ["latin"], weight: ["300","400","500","600"] });
```

To swap a font: change the import here, keep/adjust the CSS variable names (`--font-display`, `--font-sans`) which `globals.css` maps to `--font-sans`/`--font-display` utilities, and update the body className. Offline/air-gapped builds can replace `next/font/google` with `next/font/local`.

## 3. Homepage sections & flags

The homepage (`src/app/(storefront)/page.tsx`) renders sections guarded by settings flags:

- Hero carousel ← `Banner` rows (webmaster-managed)
- Category grid ← `homepage.showCategories`
- New arrivals rail ← `homepage.showNewArrivals` (products flagged `isNewArrival`)
- Best sellers rail ← `homepage.showBestSellers` (products flagged `isBestSeller`)
- Editorial section ← `homepage.showEditorial`

## 4. Adding a storefront section (worked example)

1. **Settings flag** (optional but consistent): add e.g. `showJournal?: boolean` to `StoreSettings` + `DEFAULT_SETTINGS` in `src/lib/store-settings.ts`, and to `settingsUpdateSchema.homepage` in `src/lib/validators.ts`. The deep-merge means old DB rows get the default automatically.
2. **Data**: query what you need in `src/app/(storefront)/page.tsx` (server component; the layout is `force-dynamic`, so reads are always fresh).
3. **Component**: add `src/components/storefront/journal-section.tsx`, styling with existing tokens (`font-display`, `editorial-label`, `var(--brand-accent)`).
4. **Render** it in the homepage behind the flag.
5. **Docs**: add the flag to `docs/CONFIGURATION.md`.

## 5. Extending the shipping rate model

Current model: `Courier` (code, tracking-URL template, lead times) + `ShippingRate` (`FLAT` vs `REGION` province match, `rateCents`, `freeAboveCents?`). Quoting lives in one place: `quoteShippingRates()` in `src/lib/orders.ts` (also used by `POST /api/shipping/methods` and checkout).

To add e.g. weight tiers:

1. Add `weightGrams? Int?` to `ShippingRate` in `prisma/schema.prisma`; `bun run db:generate && bun run db:push`.
2. Extend `shippingRateSchema` in `src/lib/validators.ts` and the rate form in `src/app/webmaster/(dashboard)/shipping/page.tsx`.
3. Change the matching rule inside `quoteShippingRates()` — checkout passes the chosen `shippingRateId` back and it is re-validated against a fresh quote, so tampering with rates is impossible.
4. Region matching is `normalizeRegion()` — `trim().toLowerCase()` + whitespace collapse; keep that behavior for province names.

## 6. Swapping the storage adapter (S3, R2, Cloudinary…)

Uploads are validated in `src/app/api/upload/route.ts` (staff with the `media` capability; 4 MB cap — Vercel's serverless body limit is 4.5 MB; magic-byte sniffing for JPEG/PNG/WebP) and persisted by the sink in `src/lib/storage.ts`, which stores bytes **in the database** (`MediaAsset` table) and returns `{ url: "/api/uploads/<id>" }`. Database-backed storage was chosen so the same code works on Vercel (read-only filesystem), local SQLite and VPS with zero configuration, and media ride along in ordinary DB backups.

To move to object storage:

1. Implement `saveImage()` in `src/lib/storage.ts` with your SDK call (`putObject`) — the sniffed MIME type is passed in.
2. Return the public/CDN URL instead of the `/api/uploads/<id>` path.
3. Nothing else changes — products/banners/pages store plain URL strings, and every image field accepts absolute URLs.
4. Keep the auth guard (`requireStaff("media")`) and the sniffing; only the sink changes.

## 7. Currency / locale change

Entirely settings-driven: `/webmaster/settings` → `currency` (ISO 4217), `locale`, `timezone`. Formatting flows through `src/lib/money.ts` (`formatMoney`) and `useStoreConfig()` (`src/lib/store-config.tsx`) with a special case: `IDR` renders 0 fraction digits, other currencies 2. All amounts remain **integer cents** — switching currency re-labels amounts; it does not convert historical order values, so change currency before going live, not mid-flight.

## 8. Brand asset replacement

| Asset | Location | Notes |
|---|---|---|
| Demo hero/category/product images | `public/images/`, `public/images/products/` | Referenced by seed data paths (`/images/...`); replace files or re-upload via the product editor |
| Header logo | `StoreSettings.logoUrl` (upload at `/webmaster/settings`) | Falls back to `logoText` wordmark |
| Favicon | `public/favicon.svg` | Referenced in root metadata |
| Wordmark SVG | `public/logo.svg` | Static reference asset |
| OG image | `StoreSettings.ogImageUrl` | Default `/images/hero-1.jpg` |

Seed data points at `/images/...` paths — if you remove demo images, also clear the seed rows (or run on a fresh DB without seeding).

## 9. Where things live (cheat sheet)

| Concern | File |
|---|---|
| Settings shape/defaults/merge | `src/lib/store-settings.ts` |
| Money format/parse (cents) | `src/lib/money.ts`, `useStoreConfig` in `src/lib/store-config.tsx` |
| Auth & sessions | `src/lib/auth.ts` (cookie `me_session`, 30-day TTL) |
| Roles → capabilities | `src/lib/permissions.ts` |
| Order engine (pricing/stock/idempotency/transitions) | `src/lib/orders.ts`, transitions in `src/lib/validators.ts` |
| Telegram engine | `src/lib/telegram.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| Upload/storage | `src/app/api/upload/route.ts` |
| Storefront theme vars | `src/app/globals.css` |
| Root layout & fonts & metadata | `src/app/layout.tsx` |
| Prisma schema / seed | `prisma/schema.prisma`, `prisma/seed.ts` |
