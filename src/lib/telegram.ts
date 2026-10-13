// Telegram notification engine (server-side only).
// - Credentials are managed from /webmaster/notifications and stored in the DB
//   (StoreSetting row id="telegram", see telegram-config.ts); env vars remain a
//   fallback. Never returned unmasked to any client.
// - Deliveries are logged to NotificationDelivery with bounded retries (3 attempts, backoff).
// - Fire-and-forget: callers must NEVER await inside a DB transaction. A Telegram outage
//   must never corrupt or lose an order.

import "server-only";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/api-helpers";
import { getTelegramCredentials, maskChatId } from "@/lib/telegram-config";

export type NotifyEvent =
  | "ORDER_CREATED"
  | "PAYMENT_CONFIRMED"
  | "ORDER_CANCELLED"
  | "SHIPMENT_ADDED"
  | "SHIPMENT_STATUS_CHANGED"
  | "LOW_STOCK"
  | "NEW_REGISTRATION"
  | "TEST"
  | "SYSTEM_FAILURE";

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1500;

interface DeliveryPayload {
  event: NotifyEvent;
  message: string; // pre-formatted telegram text (HTML mode)
  orderId?: string;
}

export { maskChatId } from "@/lib/telegram-config";

export async function telegramConfigured(): Promise<boolean> {
  return (await getTelegramCredentials()).configured;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function fmt(...parts: (string | number | null | undefined)[]): string {
  return parts.map((p) => (p == null ? "" : escapeHtml(String(p)))).join("");
}

// ───────────────────────── event formatters ─────────────────────────

interface OrderNotifyData {
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  totalCents: number;
  currency: string;
  status: string;
  paymentStatus: string;
  shippingMethod: string;
  itemCount: number;
}

function formatOrderMessage(event: NotifyEvent, d: OrderNotifyData, appUrl: string): string {
  const titles: Partial<Record<NotifyEvent, string>> = {
    ORDER_CREATED: "🛍 <b>New order received</b>",
    PAYMENT_CONFIRMED: "💳 <b>Payment confirmed</b>",
    ORDER_CANCELLED: "❌ <b>Order cancelled</b>",
    SHIPMENT_ADDED: "📦 <b>Tracking number added</b>",
    SHIPMENT_STATUS_CHANGED: "🚚 <b>Shipment status updated</b>",
  };
  const title = titles[event] ?? "🔔 <b>Store notification</b>";
  return [
    title,
    "",
    `Order: <b>${escapeHtml(d.orderNumber)}</b>`,
    `Placed: ${escapeHtml(d.createdAt.toISOString().replace("T", " ").slice(0, 16))} UTC`,
    `Customer: ${escapeHtml(d.customerName)}`,
    `Total: <b>${escapeHtml(formatForNotify(d.totalCents, d.currency))}</b>`,
    `Payment: ${escapeHtml(d.paymentStatus)}`,
    `Status: ${escapeHtml(d.status)}`,
    `Shipping: ${escapeHtml(d.shippingMethod)}`,
    `Items: ${d.itemCount}`,
    "",
    `Manage: ${escapeHtml(`${appUrl}/webmaster/orders`)}`,
  ].join("\n");
}

function formatForNotify(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

// ───────────────────────── delivery ─────────────────────────

async function deliver(deliveryId: string, message: string, target: string | null): Promise<void> {
  const { botToken: token, chatId, configured } = await getTelegramCredentials();

  if (!configured || !token || !chatId) {
    await db.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: "FAILED", lastError: "Telegram is not configured (set Bot Token & Chat ID in Notifications)." },
    }).catch(() => undefined);
    return;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        await db.notificationDelivery
          .update({
            where: { id: deliveryId },
            data: { status: "SENT", attempts: attempt, target, lastError: null },
          })
          .catch(() => undefined);
        return;
      }

      const body = await res.text().catch(() => "");
      // 4xx (except 429) means permanent rejection — do not retry
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        await db.notificationDelivery
          .update({
            where: { id: deliveryId },
            data: {
              status: "FAILED",
              attempts: attempt,
              target,
              lastError: `Telegram API ${res.status} (check token/chat id)`,
            },
          })
          .catch(() => undefined);
        return;
      }
      throw new Error(`Telegram API HTTP ${res.status} ${body.slice(0, 200)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (attempt === MAX_ATTEMPTS) {
        await db.notificationDelivery
          .update({
            where: { id: deliveryId },
            data: { status: "FAILED", attempts: attempt, target, lastError: msg.slice(0, 500) },
          })
          .catch(() => undefined);
        return;
      }
      await new Promise((r) => setTimeout(r, BASE_BACKOFF_MS * attempt));
    }
  }
}

/**
 * Queue a notification. Safe to call from order flows: it persists a PENDING row
 * synchronously (cheap) but the network delivery runs detached with retries.
 */
export function notify(event: NotifyEvent, message: string, orderId?: string): void {
  void (async () => {
    try {
      const creds = await getTelegramCredentials();
      const delivery = await db.notificationDelivery.create({
        data: {
          event,
          status: "PENDING",
          payload: JSON.stringify({ message: message.slice(0, 3500) }),
          orderId: orderId ?? null,
          target: creds.chatIdMasked,
        },
      });
      await deliver(delivery.id, message, creds.chatIdMasked);
    } catch {
      // never propagate — logging failure must not break business flow
    }
  })();
}

/** Convenience: order notifications include a dashboard deep-link. */
export function notifyOrderEvent(
  event: Exclude<NotifyEvent, "TEST" | "NEW_REGISTRATION" | "LOW_STOCK" | "SYSTEM_FAILURE">,
  data: OrderNotifyData
): void {
  const base = appUrl();
  const message = formatOrderMessage(event, data, base);
  notify(event, message, /* orderId unknown here; callers pass via notify() when available */ undefined);
}

/** Test button in /webmaster/notifications — awaited so the UI shows real result. */
export async function sendTestNotification(): Promise<{ ok: boolean; error?: string }> {
  const { botToken: token, chatId, configured, chatIdMasked } = await getTelegramCredentials();
  const delivery = await db.notificationDelivery.create({
    data: {
      event: "TEST",
      status: "PENDING",
      payload: JSON.stringify({ message: "Test notification" }),
      target: chatIdMasked,
    },
  });

  if (!configured || !token || !chatId) {
    const error = "Telegram is not configured — enter the Bot Token and Chat ID above, then save.";
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", lastError: error },
    });
    return { ok: false, error };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ <b>MAISON ÉLAN</b> — Telegram integration works. Order & shipment alerts will arrive here.",
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      await db.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "SENT", attempts: 1, target: maskChatId(chatId) },
      });
      return { ok: true };
    }
    const body = await res.text().catch(() => "");
    const error = `Telegram API responded HTTP ${res.status}`;
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", lastError: error, attempts: 1 },
    });
    return { ok: false, error };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network failure";
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", lastError: error.slice(0, 500), attempts: 1 },
    });
    return { ok: false, error };
  }
}
