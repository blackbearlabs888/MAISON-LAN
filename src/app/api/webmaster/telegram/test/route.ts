import { audit } from "@/lib/auth";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";
import { sendTestNotification } from "@/lib/telegram";
import { getTelegramCredentials } from "@/lib/telegram-config";

// POST /api/webmaster/telegram/test — "Send test notification" button.
export async function POST() {
  try {
    const staff = await requireStaff("notifications");
    const result = await sendTestNotification();
    await audit(staff, "TELEGRAM_TEST", "NotificationDelivery", undefined, { ok: result.ok });
    return ok(result, result.ok ? 200 : 502);
  } catch (err) {
    return handleError(err);
  }
}

// GET — current integration configuration status (secrets are masked, never returned raw).
export async function GET() {
  try {
    await requireStaff("notifications");
    const cfg = await getTelegramCredentials();
    return ok({
      configured: cfg.configured,
      source: cfg.source,
      tokenMasked: cfg.tokenMasked,
      chatIdMasked: cfg.chatIdMasked,
    });
  } catch (err) {
    return handleError(err);
  }
}
