# Contributing

Thanks for improving MAISON ÉLAN. Keep it small, keep it honest.

## Branch naming

Branch from `main` using one of these prefixes:

```
feature/<short-name>    # new functionality
fix/<short-name>        # bug fixes
docs/<short-name>       # documentation only
chore/<short-name>      # tooling, deps, config
```

Example: `feature/gift-wrap-option`, `fix/free-shipping-threshold`.

## Commits — Conventional Commits

```
feat: add gift wrap option to checkout
fix(webmaster): correct low-stock threshold comparison
docs: expand SHIPPING-SETUP with region matching rules
chore: bump prisma to 6.11
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.
Scope (optional) mirrors the area: `storefront`, `webmaster`, `api`, `db`, `docs`.

## Before opening a PR

1. `bun run lint` — must pass with zero errors. This is the shipped quality gate (this build has no automated test suites — see `docs/TESTING.md` for the manual smoke checklist and run it for anything user-facing).
2. Keep PRs focused; one logical change per PR.
3. Update the relevant docs in `docs/` when behavior, commands or settings change — docs must match reality.
4. If you touched `prisma/schema.prisma`, note it in the PR body; reviewers must run `bun run db:push` (dev) or `bun run db:migrate` (production path) after pulling.

## Hard rules

- **No secrets in code.** No tokens, passwords or connection strings in source, fixtures or docs. All secrets belong in `.env` (see `.env.example`). Dev seed credentials already documented in `README.md` must never be used in a real deployment.
- Never trust the client: prices, totals, stock, shipping rates and roles are always recomputed/checked server-side (see `src/lib/orders.ts`, `src/lib/auth.ts`, `src/lib/permissions.ts`).
- Money is **integer cents** everywhere (`*Cents` fields). UI converts at the edge (`src/lib/money.ts`, `unitsToCents` in `src/lib/webmaster-client.ts`).
- Telegram notifications must stay fire-and-forget — never awaited inside a DB transaction (`src/lib/telegram.ts`).

## Reporting

Security issues: follow `SECURITY.md` (do not open a public PR/issue).
Bugs and features: use the project tracker provided by the maintainer.
