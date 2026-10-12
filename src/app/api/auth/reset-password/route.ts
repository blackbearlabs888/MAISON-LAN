import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, hashResetToken, validatePasswordStrength } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validators";
import { ok, fail, handleError, clientIp } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(`reset:${clientIp(req)}`, { limit: 10, windowMs: 300_000 });
    if (!limited.ok) return fail("Too many attempts. Please wait.", 429);

    const input = resetPasswordSchema.parse(await req.json());
    const pwError = validatePasswordStrength(input.password);
    if (pwError) return fail(pwError, 422);

    const record = await db.passwordResetToken.findUnique({
      where: { token: hashResetToken(input.token) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
      return fail("This reset link is invalid or has expired.", 400);
    }

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(input.password) },
      }),
      db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // force re-authentication everywhere
      db.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
