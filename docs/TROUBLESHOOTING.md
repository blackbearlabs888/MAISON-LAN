# TROUBLESHOOTING

Common issues, verified against this build's actual behavior.

## Port 3000 busy

`bun run dev` pins port 3000 (`next dev -p 3000` — see `package.json`).

```bash
lsof -i :3000            # find the process
kill <pid>               # or change the port in package.json's dev script
```

A previous `dev.log`/`server.log` tee may keep a zombie process alive — kill the parent shell too. The Telegram fallback URLs assume port 3000 only for local dev; set `APP_URL` in production.

## Database locked (`SQLITE_BUSY`)

SQLite allows a single writer. Long transactions + concurrent writes (e.g. checkout during a webmaster save) can surface `database is locked`.

- Retry the operation; the checkout path wraps stock-deduction in one short transaction by design.
- Keep only **one** server process per SQLite file (never run two `next dev` instances against the same DB, and don't run `db:push` while the server is writing).
- If write contention is routine for your traffic, move to PostgreSQL (one-line datasource switch — `README.md`).

## Prisma client out of date (`Property … does not exist` / stale types)

Happens after editing `prisma/schema.prisma` or switching branches:

```bash
bun run db:generate      # regenerate the client
bun run db:push          # then align the database itself (dev)
```

## Images not loading

- Seeded imagery lives under `/images/...` (`public/images/`); uploads under `/uploads/...` (`public/uploads/`). Paths in DB rows are URL paths — the files must exist under `public/`.
- With the **standalone** build, `public/` is copied into `.next/standalone/` at build time. Files uploaded **after** the build may be missing if you serve from the standalone directory — run the build before go-live or volume-mount `public/uploads` (see `docs/DEPLOYMENT.md` § 7).
- 404s on product images after deleting files: the DB still references the path — re-upload via the product editor or clear the image row.

## Telegram test fails

`/webmaster/notifications` → "Send test notification" shows the actual error. Checklist, in order:

1. **Env not configured** — the button reports *"TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not configured"*. Both variables must be set in the server's environment; restart the dev server after editing `.env`.
2. **Wrong chat id** — Telegram answers `HTTP 400`. The chat id must be the id of the chat where the bot can post (message the bot first, or add it to the group — see `docs/TELEGRAM-SETUP.md`).
3. **Wrong token** — `HTTP 401`: token revoked or typo; re-issue via @BotFather.
4. **Network** — timeouts (10 s) or DNS failures: the server needs outbound access to `api.telegram.org`. Corporate proxies must allow it.
5. Delivery attempts are recorded in the **delivery log** on the same page (`NotificationDelivery`: PENDING → SENT/FAILED, `lastError`). Failures never block orders — orders succeed even when Telegram is down.

## Login loops (redirected back to /login)

- **Plain HTTP + production build**: `NODE_ENV=production` sets the session cookie's `Secure` flag (`src/lib/auth.ts`); browsers drop Secure cookies over plain HTTP, so you bounce back to login. Serve production behind HTTPS (`docs/DEPLOYMENT.md`) — dev (`NODE_ENV` unset) works over http://localhost.
- **Cookie blocked**: check browser cookie settings / SameSite; the cookie is `me_session`, HttpOnly, SameSite=Lax.
- **Account disabled**: deactivated users fail session validation (`isActive` check) — re-enable in `/webmaster/customers` (staff) or via DB.
- **DB reset**: sessions live in the DB; restoring/resting the DB invalidates them. Log in again.

## `Invalid email or password` for EVERY password

The stored `User.passwordHash` is **not a valid bcrypt hash**. A genuine hash is
exactly **60 characters**: `$2a$` or `$2b$` + cost `10$` + 50 random chars from
the alphabet `./A-Za-z0-9` — e.g.
`$2b$10$wLMzOvdfQqs6216wZi7OTOA.XWm/vS6q4JObIn33xU9qkSrvpFYMq`.
Red flags: wrong length (anything ≠ 60), repeating patterns (`V5V5V5…`),
truncation. These usually come from manually inserting a user row in the SQL
console with an example/placeholder hash — such a row can never log in.

**Fix** — generate a real hash and update the row:

```bash
bun run hash:password "YourNewPassword123!"    # prints a 60-char hash (self-verified)
```

```sql
UPDATE "User" SET "passwordHash" = '<paste the 60-char hash>' WHERE email = 'you@example.com';
```

Or delete the broken row and let the app create the user properly:
`DELETE FROM "User" WHERE email = '…';` → `/webmaster/setup` (first OWNER) or
re-seed (`SEED_FORCE=1` on deploy, or `bun run db:seed` locally).

## Seed duplicates

`prisma/seed.ts` is **idempotent**: settings/accounts/categories/CMS pages use `upsert`; products/couriers are skipped when their slug/code already exists; banners/FAQ are only inserted when the table is empty. Re-running `bun run db:seed` never duplicates rows. If you *want* fresh demo data: delete `db/custom.db`, `bun run db:push`, `bun run db:seed`.

## Checkout rejects the shipping method

"The selected shipping method is unavailable for this order." — the checkout re-quotes rates server-side and the client-picked `shippingRateId` must match. Causes: the rate was deactivated/edited mid-session, the cart subtotal changed (free-shipping threshold crossing), or a stale cart page. Refresh the checkout page and pick again.

## Order status change returns 409

`Cannot change order status from X to Y` — the transition map (`src/lib/validators.ts`) only allows legal forward moves (e.g. `PENDING_PAYMENT → PAID`, never `COMPLETED → SHIPPED`). Cancel/refund paths are documented in `docs/DATABASE.md` § 5.

## `bun run db:reset` fails or prompts

`db:reset` = `prisma migrate reset` — it relies on a migration history. On a pure `db:push` workflow there are no migrations; to start over simply delete `db/custom.db` and run `db:push` (+ `db:seed`).

## Webmaster returns 403 after login

You're signed in as a role without that capability (`src/lib/permissions.ts`). E.g. ORDER_MANAGER can't open `/webmaster/products` (content capability). Check the capability table in `docs/WEBMASTER-GUIDE.md`.

## Anonymous API returns 401

Correct behavior — all protected routes require the session cookie. For curl testing, log in first and pass the cookie jar (examples in `docs/TESTING.md`).
