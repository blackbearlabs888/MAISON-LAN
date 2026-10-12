# CONFIGURATION — Settings & Environment Reference

There are two configuration layers, deliberately separated:

| Layer | Where | Can hold secrets? | Applies |
|---|---|---|---|
| **StoreSettings** (white-label config) | DB singleton (`StoreSetting`, id `global`), edited at **`/webmaster/settings`** | **Never** | Runtime, no redeploy — storefront reflects changes immediately |
| **Environment variables** | `.env` / process env | **Yes — secrets only here** | On server (re)start |

Type definitions & defaults: `src/lib/store-settings.ts` (`StoreSettings`, `DEFAULT_SETTINGS`). Zod shape for updates: `settingsUpdateSchema` in `src/lib/validators.ts`. API: `GET/PUT /api/webmaster/settings` (capability `settings`).

> Reading in code: `getStoreSettings()` deep-merges the persisted JSON over `DEFAULT_SETTINGS`, so new fields added in code get safe defaults even with an old DB row.

---

## 1. Environment variables

| Variable | Required | Effect |
|---|---|---|
| `DATABASE_URL` | ✅ | Prisma connection. SQLite: `file:./db/custom.db`. PostgreSQL after datasource switch. |
| `APP_URL` | — | Base URL used in Telegram messages ("Manage: `APP_URL`/webmaster/orders"). Fallback: `http://localhost:3000`. |
| `TELEGRAM_BOT_TOKEN` | — | Bot token from @BotFather. Server-side only; never returned by any API. |
| `TELEGRAM_CHAT_ID` | — | Operator chat/group. Shown **masked** (`12****89`) in the notifications page. |

Full walkthrough for Telegram: `docs/TELEGRAM-SETUP.md`.

---

## 2. StoreSettings reference (edit at `/webmaster/settings`)

### Brand
| Field | Type / default | Effect |
|---|---|---|
| `storeName` | string, `MAISON ÉLAN` | Browser title template, maintenance screen, footer, Telegram test message |
| `tagline` | string, `Quiet luxury, considered everyday.` | Footer brand block |
| `logoText` | string, `MAISON ÉLAN` | Header wordmark fallback when no logo image is set |
| `logoUrl` | string \| null, `null` | Header logo image (upload via `/api/upload`); null → `logoText` wordmark |
| `primaryColor` | hex, `#9A7B4F` | Injected as the `--brand-accent` CSS variable on the storefront wrapper (accent lines, links, highlights). See `docs/CUSTOMIZATION.md` |
| `announcementText` | string | Text in the top announcement bar |
| `announcementEnabled` | boolean, `true` | Shows/hides the announcement bar |

### Locale / Commerce
| Field | Default | Effect |
|---|---|---|
| `currency` | `IDR` | ISO 4217 code used by all money formatting (`Intl.NumberFormat`) |
| `locale` | `id-ID` | Number/date formatting locale |
| `timezone` | `Asia/Jakarta` | Displayed/intended store timezone |
| `orderNumberPrefix` | `ME` | Order numbers: `ME-2601-A1B2C3` (`^[A-Z0-9]+$`, max 8) |

### Homepage
| Field | Default | Effect |
|---|---|---|
| `homepage.heroHeadline` | `The Autumn Atelier` | Editorial headline over the hero |
| `homepage.heroSubline` | string | Sub-headline over the hero |
| `homepage.showCategories` | `true` | Category grid section on the homepage |
| `homepage.showNewArrivals` | `true` | "New arrivals" product rail |
| `homepage.showBestSellers` | `true` | "Best sellers" product rail |
| `homepage.showEditorial` | `true` | Editorial/lookbook section |

### Operations
| Field | Default | Effect |
|---|---|---|
| `maintenanceEnabled` | `false` | Non-staff visitors see a full-page maintenance screen (store name + `maintenanceMessage` + contact mailto). Staff can still browse and operate |
| `maintenanceMessage` | `We are refining the boutique…` | Copy on the maintenance screen |
| `registrationEnabled` | `true` | `POST /api/auth/register` rejects new sign-ups when `false` (UI hides the register link too) |
| `enforceStock` | `true` | When `true`, checkout validates and deducts variant stock transactionally (overselling guard). When `false`, stock becomes informational |
| `lowStockThreshold` | `5` | Variants at/below this count trigger `LOW_STOCK` Telegram alerts (deduplicated per stock change; threshold check in `src/app/api/webmaster/helpers.ts`) |
| `newsletterEnabled` | `true` | Shows the footer newsletter signup |

### Payment (manual bank transfer)
| Field | Default | Effect |
|---|---|---|
| `paymentInstructions` | BCATARA transfer copy | Shown to the customer at checkout; include account details and "use order number as reference". Plain text, newlines preserved |
| `cancellationNote` | cancellation policy copy | Policy note surfaced around order cancellation |
| `freeShippingAboveCents` | `100000_00` | Store-wide free-shipping subtotal threshold |

**⚠️ Money semantics — integer cents.** `freeShippingAboveCents` is stored in **minor units**. The shipped default is `100000000` minor units = **Rp 1.000.000** after the usual `cents / 100` conversion used everywhere (`src/lib/money.ts`). The settings UI edits in currency units (type `1000000`) and converts once on save.

Rule of thumb: `subtotalCents >= freeShippingAboveCents` → shipping cost becomes `0` and the quote is flagged `freeApplied`. This **store-level threshold takes precedence** over any per-rate `freeAboveCents`. Because the announcement bar text is independent copy, align its wording with the value you configure (the default copy mentions a threshold of its own — check both after rebranding).

### Contact
| Field | Default | Effect |
|---|---|---|
| `contactEmail` | `care@maisonelan.example` | Footer, maintenance screen, seed CMS copy |
| `contactPhone` | `+62 21 500 8900` | Footer |
| `contactAddress` | Jakarta address | Footer |
| `social.instagram/tiktok/facebook/x` | instagram/tiktok set | Footer social links (unset ones hidden) |

### Navigation
| Field | Default | Effect |
|---|---|---|
| `navItems` | 6 items (New Arrivals + 5 collections) | Header navigation links (label + href, max 12) |
| `footerAbout` | brand paragraph | Footer "about" column |

### SEO
| Field | Default | Effect |
|---|---|---|
| `seoTitle` | `MAISON ÉLAN — Quiet luxury…` | Root metadata (title template `%s — ${storeName}`) |
| `seoDescription` | brand description | Root meta description + Open Graph |
| `ogImageUrl` | `/images/hero-1.jpg` | Open Graph image |

---

## 3. Editing payment instructions

`/webmaster/settings` → payment/operations tab → edit `paymentInstructions` (max 2000 chars). Recommended structure (matches the default):

```
Transfer the exact total to:

Bank: <bank>
Account: <number>
Name: <legal entity>

Include your order number as the transfer reference. Orders ship after payment
is verified (usually within 1 business day).
```

Customers see this text at checkout; the order enters `PENDING_PAYMENT` until staff verify the transfer and confirm payment in `/webmaster/orders/[id]` (which records a `PaymentRecord` and flips `paymentStatus → PAID_CONFIRMED`).

## 4. Maintenance mode & registration toggle

- **Maintenance mode**: flip `maintenanceEnabled` on. The (storefront) layout gates non-staff traffic server-side (`src/app/(storefront)/layout.tsx`); `/webmaster` remains reachable for staff. Remember to toggle off — there is no automatic schedule.
- **Registration toggle**: `registrationEnabled = false` stops new account creation server-side; existing customers can still log in and check out as guests.

## 5. What does *not* live in settings

Passwords/tokens (`env`), couriers & rates (`/webmaster/shipping` → DB tables), products/categories/banners/pages/FAQ (their own dashboard sections), staff accounts (DB only — see `docs/WEBMASTER-GUIDE.md`).
