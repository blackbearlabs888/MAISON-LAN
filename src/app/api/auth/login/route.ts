import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession, isStaff } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { ok, fail, handleError, clientIp } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = loginSchema.parse(body);
    const email = input.email.toLowerCase().trim();

    // two buckets: per-IP and per-email (protects credential stuffing)
    const ipLimit = rateLimit(`login:ip:${clientIp(req)}`, { limit: 10, windowMs: 60_000 });
    const emLimit = rateLimit(`login:em:${email}`, { limit: 8, windowMs: 60_000 });
    if (!ipLimit.ok || !emLimit.ok)
      return fail("Too many sign-in attempts. Please wait a minute.", 429);

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      // uniform error — never reveal whether the account exists
      return fail("Invalid email or password.", 401);
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) return fail("Invalid email or password.", 401);

    await createSession(user.id);

    return ok({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone },
      isStaff: isStaff(user.role as never),
    });
  } catch (err) {
    return handleError(err);
  }
}
