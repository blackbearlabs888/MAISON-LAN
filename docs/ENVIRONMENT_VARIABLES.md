# ENVIRONMENT VARIABLES — MAISON ÉLAN

Complete inventory of every environment variable the application reads.
**No real secret values appear in this file.** Names only.

Application code reads (verified by full grep of `src/`):
`src/lib/api-helpers.ts` (`appUrl`), `src/lib/auth.ts` (cookie policy), `src/lib/telegram-config.ts` (Telegram fallback), `src/lib/db.ts`/Prisma engine (`DATABASE_URL`), `scripts/prisma-*.cjs` (deploy-time), `src/app/api/auth/forgot-password/route.ts` (`NODE_ENV` gate).

## 1. Variables

| Name | Purpose | Where read | Required in | Secret? | Fallback when missing |
|---|---|---|---|---|---|
| `DATABASE_URL` | Primary DB connection. **Neon: use the POOLED url** (`…-pooler…?sslmode=require`). Local dev: `file:../db/custom.db` (SQLite resolves relative to `prisma/`) | Prisma engine (runtime, seed) | Local · Preview · Production | **YES** | — (app cannot start without it) |
| `DIRECT_DATABASE_URL` | Direct (unpooled) connection for CLI schema ops (`db push` at deploy time); falls back to `DATABASE_URL` | `scripts/prisma-deploy-db.cjs` | Production (recommended) · Preview (recommended) | **YES** | pooled `DATABASE_URL` |
| `APP_URL` | Canonical public origin for deep links, Telegram manage-links, robots/sitemap. Trimmed of slashes/whitespace | `src/lib/api-helpers.ts appUrl()` | Production (recommended) | no | `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL` → `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Convenience fallback for `APP_URL` (often already set on Vercel) | via `appUrl()` | optional | no | see `APP_URL` |
| `NEXT_PUBLIC_SITE_URL` | Second convenience fallback for `APP_URL` | via `appUrl()` | optional | no | see `APP_URL` |
| `TELEGRAM_BOT_TOKEN` | Telegram notification fallback credentials (DB values set in `/webmaster/notifications` win per-field) | `src/lib/telegram-config.ts` (server-only) | optional | **YES** | DB row (`StoreSetting id="telegram"`) |
| `TELEGRAM_CHAT_ID` | Telegram chat id fallback | `src/lib/telegram-config.ts` (server-only) | optional | **YES** | DB row |
| `SESSION_COOKIE_SAMESITE` | Override cookie SameSite: `none` \| `lax` (auto = None+Secure on HTTPS, Lax on plain HTTP) | `src/lib/auth.ts` | optional | no | auto-detect |
| `SEED_FORCE` | `1` = let the deploy seed fill missing rows on a **non-empty** DB (never deletes). Escape valve only — leave unset normally | `prisma/seed.ts` | optional | no | guard skips seeding when users exist |
| `NODE_ENV` | Managed by the platform (Vercel sets `production`). Gate: dev-only password-reset token exposure. **Do not set manually on Vercel** | `src/lib/auth.ts`, `forgot-password/route.ts`, `next.config.ts` | platform-managed | no | — |
| `VERCEL` | Set by Vercel; disables `output: standalone` and selects the postgres schema path in deploy scripts | `next.config.ts`, `scripts/prisma-*.cjs` | platform-managed | no | — |

### Legacy / dead names (safe to delete)

| Name | Status |
|---|---|
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | **Unused** — the app uses custom DB-session auth, not NextAuth (dependency remains installed but no code path reads these) |
| `NEXT_PUBLIC_SITE_URL` alternative spellings | only the exact names above are read |

## 2. Per-environment matrix (summary)

| Variable | Local dev | Preview (Vercel) | Production (Vercel) |
|---|---|---|---|
| `DATABASE_URL` (pooled) | ✅ sqlite | ✅ **preview** Neon pooled | ✅ **prod** Neon pooled |
| `DIRECT_DATABASE_URL` | optional | ✅ preview direct | ✅ prod direct |
| `APP_URL` or NEXT_PUBLIC fallbacks | optional | ✅ preview domain | ✅ prod domain |
| `TELEGRAM_BOT_TOKEN`/`CHAT_ID` | optional | ⬜ omit (or test chat) | optional (or DB-first) |
| `SESSION_COOKIE_SAMESITE` | optional | optional | optional |
| `SEED_FORCE` | optional | optional, once | ⬜ omit |
| `NODE_ENV`, `VERCEL` | — | platform | platform |

**Preview/Production must point at different Neon databases** (Neon branches make this natural). Never share one DB across environments.

## 3. Rotation & handling rules

- Secrets never enter the repo: no real values in `.env.example`, docs, or code (audit-verified).
- Rotate `TELEGRAM_BOT_TOKEN` via @BotFather if suspected leaked; update in `/webmaster/notifications` (DB-first) or the env var.
- Rotate DB credentials in the Neon console → update both `DATABASE_URL` and `DIRECT_DATABASE_URL` in Vercel → redeploy.
- Owner password reset without email: `bun run hash:password "NewPassword"` → paste the printed `UPDATE "User" …` statement into the Neon SQL Editor.
