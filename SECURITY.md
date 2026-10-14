# Security Policy

## Reporting a vulnerability

Report privately — **do not open a public issue or PR** for security problems.

1. Email the maintainer address provided with your purchase agreement (or use the secure contact channel in your delivery documents).
2. Include: affected version/commit, environment (dev/production), reproduction steps or PoC, impact assessment, and any logs.
3. You will receive an acknowledgment within **2 business days**.

## Responsible disclosure timeline

| Stage | Target |
|---|---|
| Acknowledgment | within 2 business days |
| Initial assessment & severity | within 5 business days |
| Fix or mitigation for High/Critical | within 30 days |
| Fix for Medium/Low | next scheduled release |
| Public disclosure | coordinated with the reporter after the fix ships; reporter credited on request |

Please avoid automated scanning against production deployments of licensees; test against your own local instance (`bun run dev`).

## Security features in this build

| Control | Implementation |
|---|---|
| Password hashing | bcryptjs, cost 10 (`src/lib/auth.ts` `hashPassword`) |
| Sessions | Opaque 32-byte random tokens, **SHA-256 hashed at rest** in the `Session` table; HttpOnly, SameSite=Lax cookie `me_session`; 30-day expiry; deleted on logout; expired/inactive users rejected server-side |
| Cookie flags | `secure` is set when `NODE_ENV=production` — serve production over HTTPS or logins will loop (see `docs/TROUBLESHOOTING.md`) |
| Authorization | Server-side role checks on **every** protected API route (`requireRole`, `requireStaff` + capability map in `src/lib/permissions.ts`); customers restricted to their own records; UI hiding is never treated as authorization |
| Input validation | Zod v4 schema parse on every API route (`src/lib/validators.ts`); status enums validated as strings |
| Order integrity | Browser-claimed prices/totals/stock never trusted — everything recomputed from DB in `src/lib/orders.ts`; checkout runs in a transaction with re-checked stock (overselling guard); idempotency key with unique index blocks duplicate orders |
| Rate limiting | In-memory per-IP/per-key limiter (`src/lib/rate-limit.ts`): login 10/min per IP + 8/min per email, register 5/min, forgot-password 5/5min (silent), reset-password 10/5min, checkout 10/min, track 20/min, newsletter 6/min, owner bootstrap 5/5min. Swap the Map for Redis behind the same interface for multi-instance deployments |
| Password reset | Uniform response (no user enumeration); token stored SHA-256-hashed, 30-minute expiry, single use. ⚠️ SMTP is not integrated — the raw token is returned in the API response **only when `NODE_ENV !== "production"`**; production installs must integrate an email provider (`src/app/api/auth/forgot-password/route.ts`) |
| Uploads | **Not implemented** — this build has no file-upload endpoint (`/api/upload` was documented by mistake, corrected in the v0.3.0 audit). Product images are referenced by URL in the webmaster catalog forms. If an upload feature is added, gate it staff-only with a size cap, MIME whitelist and magic-byte sniffing |
| CMS content | Markdown rendered via `react-markdown` with no raw-HTML path — XSS eliminated by construction (decision D-07) |
| Secrets | Telegram token/chat id are stored **DB-first** (`StoreSetting` row `id="telegram"`, set from `/webmaster/notifications`) with `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` env fallback; `DATABASE_URL` is env-only. The notifications API returns a **masked** chat id and never the token; delivery logs store the masked chat id only |
| Audit trail | `AdminAuditLog` records logins-relevant staff actions: settings updates, status changes, payment confirmations, telegram tests, owner bootstrap, and more (`audit()` in `src/lib/auth.ts`) |
| SQL injection | Prisma parameterized queries throughout; no string-built SQL |
| Enumeration | Login and forgot-password responses do not reveal account existence |
| Telegram isolation | Notifications are logged first (PENDING), delivered detached with 3 retries + backoff, never inside a DB transaction — a Telegram outage cannot fail an order |

## Hardening checklist for production installs

- Serve over HTTPS only (see `docs/DEPLOYMENT.md`) — the session cookie needs it.
- Set `APP_URL` to the public URL.
- Do **not** run `bun run db:seed` in production (it creates documented demo credentials).
- Rotate `TELEGRAM_BOT_TOKEN` via @BotFather if a leak is suspected; it is only in `.env`.
- Back up `db/custom.db` and `public/uploads/` (see `docs/BACKUP-RESTORE.md`).
- Restrict database-file access at the OS level (the SQLite file is the password DB).
