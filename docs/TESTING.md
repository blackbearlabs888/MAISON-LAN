# TESTING — Quality Gates & Verification Procedures

This build ships **without automated test suites** (sandbox restriction, decision **D-06** in `docs/DECISIONS.md`). Quality is gated by:

1. **`bun run lint`** — ESLint over the whole repo (TypeScript-aware). Must pass with zero errors.
2. **Browser E2E (manual, scripted below)** — executed during the build against the dev server.
3. **Order-engine security procedures (curl)** — documented here so any client install can re-verify the guarantees: idempotency, stock guard, fake-rate rejection, auth 401s.

If you add Vitest/Playwright in your own install, see § 5.

---

## 1. Lint gate

```bash
bun run lint      # eslint .
```

Pass = exit code 0, no errors. Run it before every commit (also stated in `CONTRIBUTING.md`).

## 2. Browser smoke checklist (golden path)

Run against a fresh DB (`db:push` + `db:seed`) with the dev server on `http://localhost:3000`. Every step should pass; failures map to `docs/TROUBLESHOOTING.md`.

**Storefront → order:**

1. Homepage loads: announcement bar, hero carousel slides, category tiles, new-arrivals + best-seller rails.
2. Header nav links (seed nav: New Arrivals, Handbags, … Fragrance) route to catalog/collections.
3. `/products`: filters by category, sort works, search returns results.
4. PDP (`/products/elan-structured-tote`): gallery switches, variant picker changes SKU/stock, add to cart updates the badge.
5. Cart page: quantity +/−, remove, subtotal correct (IDR, 0 decimals).
6. Checkout: fill address with province `DKI Jakarta`; shipping options appear (seed: Nusantara Express Reguler, Express Jakarta, SwiftLog, KurirKita Same Day); with subtotal ≥ threshold a "Free" option state appears.
7. Submit order → success page shows the order number (`ME-YYMM-XXXXXX`) and bank-transfer instructions.
8. `/track`: order number + the email used → status timeline shows `PENDING_PAYMENT`.
9. Register a new account, log out, log in; order history shows the guest order only under the guest email (account orders are separate).

**Webmaster flow (log in as owner `owner@maisonelan.dev` / `Maison2025!` — dev only):**

10. `/webmaster` dashboard: KPIs, trend chart, recent orders include your test order.
11. Orders → open the test order → **Confirm payment** (enter reference) → `paymentStatus` flips to `PAID_CONFIRMED`, status becomes `PAID`.
12. Advance status: `PAID → PROCESSING → READY_TO_SHIP`; add a shipment (courier + tracking number) → status `SHIPPED`, shipment history records entries; `/track` reflects them.
13. Products → edit a product (change price, stock) → PDP reflects it.
14. Settings → toggle announcement bar off → header bar disappears immediately.
15. Notifications → integration status (unconfigured shows masked/none), delivery log lists recent events (e.g. `ORDER_CREATED`).
16. Audit page lists your actions (`ORDER_STATUS_CHANGE`, `SETTINGS_UPDATE`, …).
17. Log in as `orders@maisonelan.dev` (ORDER_MANAGER): products/banners/settings nav hidden, direct URL access returns 403.
18. Maintenance mode: enable in settings → anonymous visitor sees the maintenance screen; staff still browse; disable again.

## 3. Order-engine security procedures (curl)

Server on `http://localhost:3000`, seeded DB.

**a) Auth 401s — anonymous access to protected APIs:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/webmaster/orders
# expected: 401

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/orders
# expected: 401 (GET /api/orders requires a user)
```

**b) Shipping quote (public, from DB rates):**

```bash
curl -s -X POST http://localhost:3000/api/shipping/methods \
  -H 'Content-Type: application/json' \
  -d '{"province":"DKI Jakarta","subtotalCents":200000000}'
# expected: quotes array (Nusantara Express Reguler, Express Jakarta, SwiftLog, KurirKita Same Day)
# with default free-shipping threshold, freeApplied: true (200000000 cents = Rp 2.000.000 ≥ threshold)
```

**c) Fake-rate rejection — a client-forged shipping rate id must be rejected:**

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "idempotencyKey": "11111111-1111-4111-8111-111111111111",
    "email": "guest@example.com", "phone": "+62811000001",
    "customerName": "Guest Tester",
    "shippingAddress": {"line1":"Jl. Test 1","city":"Jakarta Selatan",
      "province":"DKI Jakarta","postalCode":"12430","country":"Indonesia"},
    "shippingRateId": "fake-rate-id",
    "items": [{"variantId":"<real-variant-id>","quantity":1}]
  }'
# expected: 400 {"error":"The selected shipping method is unavailable for this order. Please choose another."}
```

Similarly, tampered prices are impossible by construction — the API accepts **no price fields at all** (see `checkoutSchema` in `src/lib/validators.ts`); totals are recomputed in `src/lib/orders.ts`.

**d) Stock guard — overselling attempt must fail with 409:**

```bash
# pick a variant and force low stock (dev DB)
sqlite3 db/custom.db "SELECT id, sku, stock FROM ProductVariant LIMIT 5;"
sqlite3 db/custom.db "UPDATE ProductVariant SET stock = 1 WHERE id = '<variant-id>';"

# order 2 units of it (same payload as (c), quantity 2, fresh UUID)
# expected: 409 {"error":"Only 1 left of <product> (...). Please adjust your cart."}
```

With `enforceStock: true` (default) the stock is re-checked **inside** the creation transaction, so concurrent checkouts cannot oversell either.

**e) Idempotency — duplicate submissions create exactly one order:**

```bash
# capture a real shipping rate id from (b), then submit the SAME payload twice
# (same idempotencyKey UUID, same variant, quantity 1):
curl -s -X POST http://localhost:3000/api/orders -H 'Content-Type: application/json' -d @order.json
curl -s -X POST http://localhost:3000/api/orders -H 'Content-Type: application/json' -d @order.json

# expected: both responses return the SAME orderNumber and totals; the DB holds ONE order:
sqlite3 db/custom.db "SELECT COUNT(*), orderNumber FROM Order WHERE idempotencyKey='11111111-1111-4111-8111-111111111111';"
# → 1|ME-XXXX-XXXXXX
# and stock was decremented once, not twice.
```

**f) Illegal status transition — server-side state machine:**

```bash
curl -s -c /tmp/me.jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@maisonelan.dev","password":"Maison2025!"}'   # dev-only creds

curl -s -b /tmp/me.jar -X PUT http://localhost:3000/api/webmaster/orders/<order-id> \
  -H 'Content-Type: application/json' -d '{"status":"COMPLETED"}'
# from PENDING_PAYMENT this must fail with 409 (legal: PAID | CANCELLED)
```

**g) Rate limiting (sanity):** 11 rapid `POST /api/orders` from one IP → the 11th returns 429 (limit 10/min). Login: 10/min per IP, 8/min per email.

## 4. Data-integrity spot checks

```bash
sqlite3 db/custom.db "SELECT orderNumber, subtotalCents, shippingCostCents, totalCents, status, paymentStatus FROM Order ORDER BY createdAt DESC LIMIT 3;"
# totals must equal subtotal + shipping exactly; all *Cents are integers (no floats)
sqlite3 db/custom.db "SELECT COUNT(*) FROM OrderStatusHistory WHERE orderId=(SELECT id FROM Order LIMIT 1);"
# every order has ≥1 history row ("Order created")
```

## 5. Adding automated tests in client installs (recommended next step)

Nothing in the codebase prevents standard tooling (decision D-06 is about *this* sandbox build):

- **Unit (Vitest)**: `src/lib/money.ts` (`parseMoneyToCents`, `effectiveUnitPriceCents`), `src/lib/orders.ts` (`generateOrderNumber`, `assertTransition` via the `ORDER_TRANSITIONS` map), `src/lib/store-settings.ts` merge behavior.
- **Integration (Vitest + test DB)**: point `DATABASE_URL` at a scratch SQLite file, `db:push`, then exercise `createOrderFromCheckout` directly: idempotency, stock race, fake rate, archived product.
- **E2E (Playwright)**: codify the § 2 script — seed → golden path → webmaster transitions → track. Auth via `request.post('/api/auth/login')` storing cookies.
- **API conventions to keep**: every route parses Zod; every protected route calls `requireUser/requireRole/requireStaff`; notifications stay fire-and-forget. Test that new routes do the same.
