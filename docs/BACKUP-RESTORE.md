# BACKUP & RESTORE

What matters: **the database** (orders, customers, settings) and **`public/uploads/`** (media referenced by DB rows). Back up both, together, on a schedule, and rehearse the restore.

## 1. SQLite (default install)

All state lives in one file: `db/custom.db` (path from `DATABASE_URL`, resolved relative to `prisma/`). The file holds credentials (bcrypt hashes) — protect it at the OS level.

### One-off consistent backup

Use SQLite's `.backup` (safe while the server is running; plain `cp` can catch the file mid-write):

```bash
sqlite3 db/custom.db ".backup '/backups/custom-$(date +%F-%H%M).db'"
```

If `sqlite3` CLI is unavailable, stop the server briefly and `cp` the file — acceptable for boutique traffic.

### Scheduled backup (cron)

Nightly backup + weekly copy off the machine:

```cron
# crontab -e
0 2 * * *   sqlite3 /opt/maison-elan/db/custom.db ".backup '/backups/db/custom-$(date +\%F).db'" && find /backups/db -name 'custom-*.db' -mtime +14 -delete
30 2 * * 0  rsync -a /backups/db/ backup-host:/srv/backups/maison-elan/db/
```

(escape `%` as `\%` in cron). Add `public/uploads` to the off-site job too.

## 2. Media (`public/uploads/`)

```bash
tar czf /backups/uploads-$(date +%F).tgz -C /opt/maison-elan/public uploads
```

Schedule it right after the DB job. DB rows reference media by URL (`/uploads/<name>`), so a DB restore without media yields broken images — always restore both.

## 3. PostgreSQL (production installs after the datasource switch)

```bash
# backup (custom format, compressed)
pg_dump "$DATABASE_URL" -Fc -f /backups/maison-elan-$(date +%F).dump

# restore into a fresh database
createdb maison_elan
pg_restore -d maison_elan /backups/maison-elan-2026-01-31.dump
```

Schedule with the same cron pattern; keep at least 14 days of history and one copy off-site.

## 4. Restore procedure (SQLite)

1. Stop the app (`systemctl stop maison-elan` or equivalent) to avoid concurrent writes.
2. Replace the database:

   ```bash
   cp /backups/db/custom-2026-01-31.db /opt/maison-elan/db/custom.db
   ```

3. Restore media into `public/uploads/` (and into the standalone bundle path if you volume-mounted it — see `docs/DEPLOYMENT.md` § 7).
4. If the backup predates a schema change, re-align the schema:

   ```bash
   bun run db:push          # dev-style sync
   # or: bunx prisma migrate deploy   # if using migrations
   ```

5. Start the app and verify: homepage renders, login works, a recent order opens in `/webmaster/orders`, product images load.

## 5. Disaster recovery checklist

- [ ] Latest DB backup + media archive available (verify file sizes, not just dates).
- [ ] `.env` recoverable from the secrets manager (DATABASE_URL, APP_URL, Telegram creds) — **it is not in git**.
- [ ] Source available (git remote) and a tested `bun install && bun run build`.
- [ ] Restore into a scratch directory first; spot-check order totals and images.
- [ ] After restore: rotate `TELEGRAM_BOT_TOKEN` if the incident involved a leak; review `/webmaster/audit` for unexpected activity.
- [ ] Document the incident time window — orders taken during it may need manual reconciliation against bank statements (payments are manual transfers anyway).

## 6. What is *not* in backups (by design)

- `.env` secrets — keep them in a secrets manager.
- `node_modules`, `.next` — reproducible from source.
- Sessions — restoring an older DB logs users out (session rows revert); that is acceptable and safe.
