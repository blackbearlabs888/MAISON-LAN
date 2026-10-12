# TELEGRAM SETUP — Operator Notifications

Push order/payment/shipment/stock/registration alerts to your Telegram chat. Credentials are managed from the web UI (**/webmaster/notifications** → "Telegram configuration") and stored **in the database** (`StoreSetting` row `telegram`) — no redeploy or restart needed. Environment variables (`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`) still work as a fallback for infrastructure-level defaults; database values win per-field. Secrets are never returned unmasked to any API response (masked previews only).

## 1. Create the bot

1. In Telegram, open **[@BotFather](https://t.me/BotFather)**.
2. Send `/newbot` → choose a display name (e.g. "Maison Élan Ops") and a username ending in `bot`.
3. BotFather replies with the **token**: `123456789:AA...long-string`. You will paste it into the **Bot Token** field on /webmaster/notifications.
   - To rotate later: `/revoke` (or `/token`), then paste the new token on the notifications page and save.

## 2. Get your chat id

Option A — **@userinfobot**: message [@userinfobot](https://t.me/userinfobot); it replies with your `Id` (a number like `847261935`). That's your **Chat ID**.

Option B — **getUpdates**:

1. Send any message to your new bot (press *Start*). For a **group**: add the bot to the group and post once.
2. Call:

   ```bash
   curl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
   ```

3. Find `"chat":{"id": ...}` in the response — private chats have a positive number, groups a negative one (`-100…` for supergroups). Use that number as the **Chat ID**.

> The bot can only message a chat after someone has messaged it first (or it's been added to the group) — otherwise sends fail with `HTTP 400 "chat not found"`.

## 3. Configure (database — recommended)

1. Sign in as staff and open **/webmaster/notifications**.
2. Paste the **Bot Token** and **Chat ID**, press **Save to database**.
3. Values are validated (token format, numeric/@channel chat id) and stored in the DB.
   - Leave a field empty to keep its stored value; **Clear stored** removes the DB copy (env fallback resumes if present).

**Environment fallback (optional):** for container/IaC setups you may instead set in `.env`:

```bash
TELEGRAM_BOT_TOKEN="123456789:AA..."
TELEGRAM_CHAT_ID="847261935"
```

DB values take precedence per-field; a restart is never required because credentials are read fresh from the database on every send.

## 4. Verify with the test button

1. Log into `/webmaster` → **Notifications**.
2. Status shows `configured: yes` and the **masked** chat id (`84****35`).
3. Click **Send test notification**. You should receive within seconds:

   > ✅ **MAISON ÉLAN** — Telegram integration works. Order & shipment alerts will arrive here.

   The result (or the exact error) is shown in the UI and recorded in the delivery log below (event `TEST`).

## 5. Events

| Event | Fired when | Source |
|---|---|---|
| `ORDER_CREATED` | Checkout commits a new order (guest or member) | `POST /api/orders` |
| `PAYMENT_CONFIRMED` | Staff confirm the bank transfer | webmaster order detail |
| `ORDER_CANCELLED` | Order cancelled | webmaster order detail |
| `SHIPMENT_ADDED` | Tracking number saved on an order | webmaster shipment panel |
| `SHIPMENT_STATUS_CHANGED` | Shipment status updated manually | webmaster shipment panel |
| `LOW_STOCK` | A variant's stock is at/below `lowStockThreshold` (5 by default) after a stock change | `src/app/api/webmaster/helpers.ts` |
| `NEW_REGISTRATION` | A new customer account is created | `POST /api/auth/register` |
| `TEST` | The dashboard test button | `POST /api/webmaster/telegram/test` |

Order messages include order number, placed time (UTC), customer, total, payment/status, shipping method, item count and a **Manage** deep-link built from `APP_URL` (set it in production!).

## 6. Reliability notes (why an outage can't hurt an order)

Engine: `src/lib/telegram.ts`.

- **Queue-then-send**: a `NotificationDelivery` row (status `PENDING`) is persisted first; delivery then runs **detached** — notifications are never awaited inside an order transaction, so a Telegram outage can never corrupt, delay or lose an order.
- **Retries**: up to **3 attempts** with linear backoff (1.5 s, 3 s); 10 s timeout per attempt. Permanent `4xx` responses (bad token / wrong chat id) fail immediately — only `5xx`/network errors retry.
- **Auditability**: every attempt's final state (`SENT`/`FAILED`), attempt count, masked target and `lastError` are visible in `/webmaster/notifications`.
- **Secret safety**: the token exists only in the env of the server process; API responses and the DB store only a masked chat id.
- **Turn it off**: press **Clear stored** on /webmaster/notifications (and remove any env fallback, then restart) — events are still logged to `NotificationDelivery` (as failures with "not configured"), and orders continue working. To silence fully, also ignore the log page.
