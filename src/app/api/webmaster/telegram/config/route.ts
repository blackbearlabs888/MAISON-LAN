import { NextRequest } from "next/server";
import { audit } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";
import {
  getTelegramCredentials,
  saveTelegramCredentials,
  clearTelegramCredentials,
} from "@/lib/telegram-config";
import { telegramConfigSchema } from "@/lib/validators";

// GET /api/webmaster/telegram/config — masked status for the notifications page.
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

// PUT /api/webmaster/telegram/config — save Bot Token / Chat ID to the database.
// Empty string = "leave unchanged" (so one field can be updated alone).
export async function PUT(req: NextRequest) {
  try {
    const staff = await requireStaff("notifications");
    const input = telegramConfigSchema.parse(await req.json());

    const current = await getTelegramCredentials();
    const botToken = input.botToken ? input.botToken : current.botToken;
    const chatId = input.chatId ? input.chatId : current.chatId;

    if (!botToken || !chatId) {
      return fail("Both Bot Token and Chat ID are required.", 400);
    }

    await saveTelegramCredentials({ botToken, chatId });
    await audit(staff, "TELEGRAM_CONFIG_SAVE", "StoreSetting", "telegram", {
      source: "database",
      chatIdMasked: `${chatId.slice(0, 2)}****${chatId.slice(-2)}`,
    });

    const next = await getTelegramCredentials();
    return ok({
      configured: next.configured,
      source: next.source,
      tokenMasked: next.tokenMasked,
      chatIdMasked: next.chatIdMasked,
    });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/webmaster/telegram/config — wipe the database copy (env fallback resumes).
export async function DELETE() {
  try {
    const staff = await requireStaff("notifications");
    await clearTelegramCredentials();
    await audit(staff, "TELEGRAM_CONFIG_CLEAR", "StoreSetting", "telegram", undefined);
    const next = await getTelegramCredentials();
    return ok({
      configured: next.configured,
      source: next.source,
      tokenMasked: next.tokenMasked,
      chatIdMasked: next.chatIdMasked,
    });
  } catch (err) {
    return handleError(err);
  }
}
