import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  verifyPassword,
  hashPassword,
  validatePasswordStrength,
} from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUser();
    const input = changePasswordSchema.parse(await req.json());

    const pwError = validatePasswordStrength(input.newPassword);
    if (pwError) return fail(pwError, 422);

    const user = await db.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) return fail("Account not found.", 404);

    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) return fail("Current password is incorrect.", 403);

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });

    // revoke all other sessions after password change (session hygiene)
    await db.session.deleteMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
    });

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
