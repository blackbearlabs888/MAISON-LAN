# SHIPPING SETUP — Manual Shipping Guide

Shipping is **fully manual** (no courier APIs): you define couriers and rates, the storefront quotes them at checkout, and your team dispatches and updates tracking by hand. Models: `Courier` + `ShippingRate` (`prisma/schema.prisma`); quoting engine: `quoteShippingRates()` in `src/lib/orders.ts`; manage at **`/webmaster/shipping`** (OWNER/ADMIN/ORDER_MANAGER).

## 1. Couriers

Per courier:

| Field | Rules |
|---|---|
| `name` | display name (e.g. "Nusantara Express") |
| `code` | unique, uppercase `^[A-Z0-9_]+$` (e.g. `NEX`) |
| `trackingUrlTemplate` | optional; **must contain `{trackingNumber}`** when set (Zod-enforced). The customer-facing tracking URL is built by replacing the placeholder |
| `minDays` / `maxDays` | optional lead-time range shown with quotes |
| `position` | display order; `isActive` toggles availability |

Examples from the seed:

```
https://tracking.nusantara-express.example/?no={trackingNumber}
https://swiftlog.example/track/{trackingNumber}
```

If the template is empty (seed courier `KITA`), no tracking URL is generated — the tracking number alone is shown.

## 2. Rates

Per rate:

| Field | Meaning |
|---|---|
| `name` | service name ("Reguler", "Express Jakarta") |
| `type` | **`FLAT`** — applies nationwide (use `region = "*"`) · **`REGION`** — applies only when the customer's province matches `region` |
| `region` | `"*"` or a province name — matched **case-insensitively** with whitespace normalization (`"dki   jakarta"` matches `"DKI Jakarta"`) |
| `rateCents` | cost in **integer cents** (UI enters currency units; `2000000` cents = Rp 20.000) |
| `freeAboveCents` | optional per-rate free-shipping subtotal |

Seed defaults: NEX Reguler FLAT Rp 20.000 · NEX Express Jakarta REGION (DKI Jakarta) Rp 35.000 · SwiftLog Reguler FLAT Rp 18.000 · KurirKita Same Day REGION (DKI Jakarta) Rp 40.000.

### Free-shipping thresholds — two levels

1. **Store-wide** (`StoreSettings.freeShippingAboveCents`, edited in `/webmaster/settings`): if `subtotalCents ≥ threshold`, **every** matching quote becomes free. Default `100000_00` = 10,000,000 minor units = **Rp 100.000** — enter `1000000` in the settings UI for Rp 1.000.000. Set it empty (`null`) to disable.
2. **Per-rate** (`ShippingRate.freeAboveCents`): applies only to that rate, and only when no store-wide threshold has already made it free (store-wide wins).

Matching precedence in code: store-wide check first, then the rate's own threshold (`src/lib/orders.ts`).

## 3. Checkout quote flow

1. The customer enters the shipping address → the storefront calls `POST /api/shipping/methods` with `{ province, subtotalCents }` (subtotal is display-only for the quote call).
2. The server returns all **active rates of active couriers** matching the province (FLAT always; REGION on a case-insensitive province match), each with `rateCents`, `freeApplied`, and the courier lead-time range. Quotes are ordered by courier position, then price.
3. At submit, checkout **re-quotes server-side** and validates the chosen `shippingRateId` against that fresh quote list — a forged/stale/expired rate id is rejected (`400`), and the shipping cost is always the server's number, never the browser's.
4. The chosen label ("Nusantara Express — Reguler") and cost are snapshotted onto the order.
5. If no rate matches the province, the API explains: "No shipping methods are configured for your region yet."

## 4. Manual tracking updates — important disclaimer

Tracking on this platform is **manual**: statuses are whatever your team enters and are **not synchronized with any courier system**. The customer sees your status history on `/track` plus the courier's own tracking link (from the template). Communicate the lag honestly — the seeded "Shipping Policy" CMS page already says tracking here "may lag live courier data by a few hours" and points to the courier's page as the current source.

## 5. Shipment lifecycle

One `Shipment` per order (created when you add courier/tracking in the order detail):

```
PENDING → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
                     ↘ EXCEPTION          ↘ RETURNED
```

- Every change appends a `ShipmentStatusHistory` row and (when configured) fires a `SHIPMENT_STATUS_CHANGED` Telegram alert; adding the tracking fires `SHIPMENT_ADDED`.
- Order-level status (`SHIPPED → COMPLETED`) is separate — move it when the delivery is confirmed.

## 6. Setup checklist

- [ ] Couriers entered with codes, lead times, tracking-URL templates containing `{trackingNumber}`.
- [ ] Rates cover **every province you serve** (a FLAT `*` rate is the catch-all; add REGION overrides for metro pricing).
- [ ] Free-shipping thresholds decided (store-wide in Settings, per-rate optional) — remember: **integer cents**.
- [ ] Test quote: `POST /api/shipping/methods` with `{"province":"DKI Jakarta","subtotalCents":50000000}`.
- [ ] Golden-path test order dispatched end-to-end (see `docs/TESTING.md` § 2).
