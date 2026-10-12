import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength, createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { ok, fail, handleError, clientIp } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { getStoreSettings } from "@/lib/store-settings";
import { notify, fmt } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(`register:${clientIp(req)}`, { limit: 5, windowMs: 60_000 });
    if (!limited.ok) return fail("Too many attempts. Please wait a minute.", 429);

    const body = await req.json();
    const input = registerSchema.parse(body);

    const settings = await getStoreSettings();
    if (!settings.registrationEnabled) {
      return fail("Registration is currently disabled.", 403);
    }

    const email = input.email.toLowerCase().trim();
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) return fail("An account with this email already exists.", 409);

    const pwError = validatePasswordStrength(input.password);
    if (pwError) return fail(pwError, 422);

    const user = await db.user.create({
      data: {
        email,
        passwordHash: await hashPassword(input.password),
        name: input.name.trim(),
        phone: input.phone || null,
        role: "CUSTOMER",
      },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });

    await createSession(user.id);

    // fire-and-forget Telegram registration alert (never blocks signup)
    notify(
      "NEW_REGISTRATION",
      `👤 <b>New customer registered</b>\n\nName: ${fmt(user.name)}\nEmail: ${fmt(user.email)}`
    );

    return ok({ user }, 201);
  } catch (err) {
    return handleError(err);
  }
}
