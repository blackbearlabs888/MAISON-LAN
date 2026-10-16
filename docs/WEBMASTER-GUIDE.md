# WEBMASTER GUIDE — Operator Manual

The dashboard lives at **`/webmaster`**. Every capability is enforced **server-side** per API route (`src/lib/permissions.ts` + `requireStaff` in `src/app/api/webmaster/helpers.ts`) — the menu hiding in the UI only mirrors what the server allows.

## 1. First-owner bootstrap

- On a fresh install (no OWNER account exists), opening `/webmaster` redirects to **`/webmaster/setup`**.
- The form creates **exactly one OWNER** (email + name + strong password: ≥8 chars, letters and numbers), signs you in, and writes an `OWNER_BOOTSTRAP` entry to the audit log.
- The endpoint checks `role = OWNER` count and returns **409** once any owner exists — the bootstrap is permanently closed afterwards. Rate-limited to 5 attempts / 5 min per IP.
- No default production credentials ship with the product. The seed's demo accounts (`owner@maisonelan.dev` / `Maison2025!` etc.) are **dev-only** — never seed a real store.

## 2. Roles & capabilities

| Capability | OWNER | ADMIN | ORDER_MANAGER | CONTENT_MANAGER |
|---|:-:|:-:|:-:|:-:|
| Orders (list, status, payments, shipments) | ✅ | ✅ | ✅ | — |
| Customers (view, disable) | ✅ | ✅ | ✅ | — |
| Shipping (couriers & rates) | ✅ | ✅ | ✅ | — |
| Notifications (Telegram health, test, log) | ✅ | ✅ | ✅ | — |
| Audit log | ✅ | ✅ | ✅ | — |
| Products | ✅ | ✅ | — | ✅ |
| Categories | ✅ | ✅ | — | ✅ |
| Banners | ✅ | ✅ | — | ✅ |
| CMS pages | ✅ | ✅ | — | ✅ |
| FAQ | ✅ | ✅ | — | ✅ |
| Settings | ✅ | ✅ | — | — |

(`CUSTOMER` has no webmaster access. File uploads via `/api/upload` need the `media` capability: OWNER, ADMIN, CONTENT_MANAGER — not ORDER_MANAGER.)

## 3. Daily order workflow (manual bank transfer)

This is the core loop — payments are verified by humans, shipping is manual:

1. **Check new orders** — `/webmaster/orders`, filter `PENDING_PAYMENT`; Telegram pushes an `ORDER_CREATED` alert when configured.
2. **Verify the bank transfer** — match the received transfer (amount = order `totalCents`, reference = order number) against your bank statement/app.
3. **Confirm payment** — order detail → *Confirm payment* → enter the bank reference/note. This records a `PaymentRecord`, flips `paymentStatus → PAID_CONFIRMED`, sets `status → PAID` and `paidAt`, and fires the `PAYMENT_CONFIRMED` Telegram alert.
4. **Prepare** — advance `PAID → PROCESSING → READY_TO_SHIP` (each hop is a legal transition; history records actor + note).
5. **Add tracking** — in the shipment panel choose the courier, enter the tracking number (+ optional estimated delivery and note). Creates the `Shipment`, builds the customer-facing tracking URL from the courier template, fires `SHIPMENT_ADDED`.
6. **Dispatch** — hand the parcel to the courier, then set the shipment status (`IN_TRANSIT`, `OUT_FOR_DELIVERY`, …). Each change appends `ShipmentStatusHistory` and fires `SHIPMENT_STATUS_CHANGED`. Order status moves to `SHIPPED`.
7. **Complete** — after delivery confirmation set the shipment `DELIVERED` and the order `COMPLETED`.

Cancellations: allowed while `PENDING_PAYMENT` (and later stages per the transition map — `docs/DATABASE.md` § 5); always fill the cancellation reason. Refunds are terminal transitions from `PAID`/`PROCESSING`/`READY_TO_SHIP`/`COMPLETED`.

## 4. Products

- Create/edit at `/webmaster/products` → editor: name, kebab-case slug, description, details (markdown), **priceCents in currency units** (converted once on save), optional sale price (only used when lower than base), SKU base, material, flags (featured / new arrival / best seller / active), up to 8 images (drag-order by position), ≥1 variant.
- **Variants**: size and/or color, unique **SKU**, integer **stock**, optional `priceDeltaCents` added to the unit price (e.g. the 100 ml fragrance +Rp 900.000 in the seed).
- Images: upload via the editor (`POST /api/upload`, JPEG/PNG/WebP, ≤4 MB, magic-byte sniffed) → stored in the database (`MediaAsset`) and served from `/api/uploads/<id>`, first image is the card/cart thumbnail.
- Stock edits trigger the low-stock check (`stock ≤ lowStockThreshold` → `LOW_STOCK` Telegram alert).
- Archiving (rather than deleting) preserves order history references.

## 5. Categories

`/webmaster/categories`: name, slug, description, tile image, position (ordering), active toggle. Active categories drive the homepage grid and `/collections/[slug]` landing pages.

## 6. Banners

`/webmaster/banners`: hero slides for the homepage carousel — title, subtitle, image (+ optional mobile image), CTA text/URL, position, active toggle, optional `startsAt`/`endsAt` window.

## 7. CMS pages

`/webmaster/pages`: markdown content (rendered **sanitized** — no raw HTML), publish toggle, footer visibility, per-page SEO title/description. Footer links list up to 8 published pages marked `showInFooter`. `FAQ` entries are managed separately at `/webmaster/faq` (question/answer/position/active).

## 8. Customers

`/webmaster/customers`: search, inspect profile/addresses/orders, **deactivate** (`isActive = false` — instantly invalidates sessions and blocks login). Reactivate anytime. Roles are not editable here (see § 11).

## 9. Settings

`/webmaster/settings` — the white-label heart. Tabs cover brand identity, homepage toggles, commerce/locale, operations (maintenance mode, registration, stock enforcement, low-stock threshold, payment instructions, cancellation note, free-shipping threshold), contact/social, navigation items, SEO. Money fields are entered **in currency units** and stored as integer cents. Saving takes effect on the storefront immediately; changes are audited (`SETTINGS_UPDATE`). Full field reference: `docs/CONFIGURATION.md`.

## 10. Notifications health

`/webmaster/notifications` shows: integration status (configured yes/no, **masked** chat id — the token is never displayed), a **Send test notification** button (real round-trip; result and error text are shown), and the delivery log (last 60 `NotificationDelivery` rows with counters SENT/FAILED/PENDING). Setup guide: `docs/TELEGRAM-SETUP.md`.

## 11. Adding staff accounts (honest path: DB, no UI)

There is **no staff-creation UI in v1** — by design (see `docs/KNOWN-ISSUES.md`). Create staff directly in the database:

```bash
bunx prisma studio     # opens a DB GUI at http://localhost:5555
```

1. Hash a password (cost 10) with bcryptjs — e.g. `bun -e "import('bcryptjs').then(b=>b.default.hash(process.argv[1],10).then(console.log))" 'YourStrongPass1'`
2. In Prisma Studio → `User` → create: `email`, `passwordHash` (paste the hash), `name`, `role` = `ADMIN` | `ORDER_MANAGER` | `CONTENT_MANAGER`, `isActive` = true.
3. The user logs in at `/login` immediately; capabilities apply per § 2.

Alternative via SQL (SQLite CLI), same steps — insert into `User` with a bcrypt hash. Never reuse the documented dev passwords.

## 12. Audit log

`/webmaster/audit` — who did what, when: status changes, payment confirmations, settings updates, telegram tests, owner bootstrap, customer toggles, and more. Filter by actor/action. Retention is manual (rows persist; `actor` survives user deletion via SetNull).

## 13. Quick operator checklists

**Morning:** open orders (`PENDING_PAYMENT`) → verify transfers → confirm payments. Scan low-stock list on the dashboard; restock via product editor.

**Before a campaign:** banners positioned, homepage toggles, free-shipping threshold sane, Telegram test passes, couriers/rates active for all provinces you serve.

**Incident:** maintenance mode on → fix → off; check `/webmaster/audit` for unexpected changes; rotate the Telegram token via @BotFather only if leaked (env var update + restart).
