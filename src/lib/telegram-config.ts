// Telegram credentials storage — DATABASE-FIRST (managed from /webmaster/notifications).
// - Primary source: StoreSetting row id="telegram" (botToken + chatId as JSON),
//   editable at runtime from the notifications page — no redeploy needed.
// - Environment vars (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) remain a FALLBACK
//   so existing deployments keep working; database values win when both exist.
// - Tokens are NEVER returned unmasked to any API response — masking helpers below.

import "server-only";
import { db } from "@/lib/db";

export interface TelegramCredentials {
  botToken: string | null;
  chatId: string | null;
}

export type TelegramConfigSource = "database" | "env" | "none";

export interface TelegramConfigStatus extends TelegramCredentials {
  source: TelegramConfigSource;
  /** both credentials present — notifications can be delivered */
  configured: boolean;
  tokenMasked: string | null;
  chatIdMasked: string | null;
}

const TELEGRAM_SETTINGS_ID = "telegram";

function maskToken(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 10) return "••••";
  const colon = token.indexOf(":");
  const head = colon > 0 ? token.slice(0, colon + 1) : token.slice(0, 3);
  return `${head}••••${token.slice(-4)}`;
}

export function maskChatId(chatId: string | null | undefined): string | null {
  if (!chatId) return null;
  if (chatId.length <= 4) return "****";
  return `${chatId.slice(0, 2)}****${chatId.slice(-2)}`;
}

async function readDbCredentials(): Promise<TelegramCredentials> {
  try {
    const row = await db.storeSetting.findUnique({ where: { id: TELEGRAM_SETTINGS_ID } });
    if (!row) return { botToken: null, chatId: null };
    const parsed = JSON.parse(row.data) as Partial<TelegramCredentials>;
    return {
      botToken: typeof parsed.botToken === "string" && parsed.botToken ? parsed.botToken : null,
      chatId: typeof parsed.chatId === "string" && parsed.chatId ? parsed.chatId : null,
    };
  } catch {
    // corrupted row must never break delivery — fall back to env
    return { botToken: null, chatId: null };
  }
}

function envCredentials(): TelegramCredentials {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || null,
    chatId: process.env.TELEGRAM_CHAT_ID || null,
  };
}

/** DB values win per-field; env fills the gaps. */
export async function getTelegramCredentials(): Promise<TelegramConfigStatus> {
  const [dbCreds, envCreds] = await Promise.all([readDbCredentials(), Promise.resolve(envCredentials())]);

  const merged: TelegramCredentials = {
    botToken: dbCreds.botToken ?? envCreds.botToken,
    chatId: dbCreds.chatId ?? envCreds.chatId,
  };

  const touchedInDb = Boolean(dbCreds.botToken || dbCreds.chatId);
  const source: TelegramConfigSource =
    merged.botToken && merged.chatId
      ? touchedInDb
        ? "database"
        : "env"
      : touchedInDb
        ? "database"
        : envCreds.botToken || envCreds.chatId
          ? "env"
          : "none";

  return {
    ...merged,
    source,
    configured: Boolean(merged.botToken && merged.chatId),
    tokenMasked: maskToken(merged.botToken),
    chatIdMasked: maskChatId(merged.chatId),
  };
}

/** Persist credentials from the notifications page (StoreSetting row id="telegram"). */
export async function saveTelegramCredentials(creds: TelegramCredentials): Promise<void> {
  const data = JSON.stringify({ botToken: creds.botToken, chatId: creds.chatId });
  await db.storeSetting.upsert({
    where: { id: TELEGRAM_SETTINGS_ID },
    update: { data },
    create: { id: TELEGRAM_SETTINGS_ID, data },
  });
}

/** Wipe the database copy (env fallback, if any, resumes automatically). */
export async function clearTelegramCredentials(): Promise<void> {
  await saveTelegramCredentials({ botToken: null, chatId: null });
}
