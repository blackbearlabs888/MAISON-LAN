# RELEASE CHECKLIST

Run every gate before tagging a release or handing an install to a client. Nothing here may be "assumed".

## 1. Code quality

- [ ] `bun run lint` passes (exit 0, zero errors).
- [ ] No secrets anywhere: `rg -n "TELEGRAM_BOT_TOKEN\s*=\s*['\"]?[0-9]" src docs` empty; `.env` not committed; `.env.example` contains placeholders only.
- [ ] Docs match reality — commands in README/docs equal `package.json` scripts; settings field list matches `src/lib/store-settings.ts`; capability table matches `src/lib/permissions.ts`; model list matches `prisma/schema.prisma`.

## 2. Fresh-clone install (clean machine or container)

- [ ] `git clone` → `bun install` succeeds.
- [ ] `cp .env.example .env` → `bun run db:push` creates the schema without errors.
- [ ] On a **clean DB** (fresh `db/custom.db`): `bun run db:seed` completes and prints the three dev accounts; re-running the seed does **not** duplicate anything (idempotency check).

## 3. Auth bootstrap

- [ ] Dev path: seed accounts log in (`owner@maisonelan.dev`, `orders@maisonelan.dev`, `customer@example.com`).
- [ ] Production path: on a DB **without** seed, `/webmaster/setup` creates the first OWNER; a second visit correctly reports an owner exists (409); the account appears in `/webmaster/audit` as `OWNER_BOOTSTRAP`.

## 4. Golden-path manual test

Execute `docs/TESTING.md` § 2 end to end (storefront → checkout → payment confirm → shipment → track → webmaster checks 10–18) on the release build (`bun run build && bun run start`), not only dev.

## 5. Order-engine guarantees (curl)

Re-run `docs/TESTING.md` § 3: auth 401s, fake-rate rejection (400), stock guard (409), idempotency (one order, one stock decrement), illegal transition (409), rate limiting (429).

## 6. Notifications

- [ ] Telegram configured **or intentionally off** (decision recorded). If on: test button returns ok; `ORDER_CREATED` arrives for a test order; delivery log healthy.
- [ ] `APP_URL` set so deep-links resolve.

## 7. Data safety

- [ ] Backup of `db/custom.db` + `public/uploads/` taken **and restore rehearsed** (`docs/BACKUP-RESTORE.md` § 4) on the release candidate.
- [ ] If PostgreSQL: `pg_dump` restore drill done; datasource provider switched in `prisma/schema.prisma`.

## 8. Production hardening

- [ ] HTTPS in front of the app (session cookie is `Secure` in production).
- [ ] `NODE_ENV=production` (via `bun run start` / systemd unit).
- [ ] No seed data in the production DB; dev accounts absent (`SELECT email FROM User WHERE email LIKE '%maisonelan.dev'` returns 0 rows).
- [ ] Log rotation configured (`docs/DEPLOYMENT.md` § 7).
- [ ] LICENSE finalized (TODO section resolved per purchaser decision).

## 9. Ship

- [ ] Version bumped (`CHANGELOG.md` entry with date + highlights).
- [ ] Tag: `git tag -a vX.Y.Z -m "..."` and push.
- [ ] Announce known limitations (`docs/KNOWN-ISSUES.md`) to the client alongside the delivery notes.
