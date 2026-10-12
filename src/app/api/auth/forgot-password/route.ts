import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateResetToken } from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/validators";
import { ok, handleError, clientIp } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(`forgot:${clientIp(req)}`, { limit: 5, windowMs: 300_000 });
    if (!limited.ok) return ok({ success: true }); // silent throttle

    const input = forgotPasswordSchema.parse(await req.json());
    const email = input.email.toLowerCase().trim();

    const user = await db.user.findUnique({ where: { email } });

    // Uniform response regardless of account existence (no user enumeration).
    let devResetToken: string | undefined;
    if (user && user.isActive) {
      const { raw, hashed } = generateResetToken();
      await db.passwordResetToken.create({
        data: {
          token: hashed,
          userId: user.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 min
        },
      });
      // SMTP is not part of this release; in non-production we return the raw
      // token so the flow remains testable. Production installs integrate an
      // email provider here (see docs/CONFIGURATION.md).
      if (process.env.NODE_ENV !== "production") devResetToken = raw;
    }

    return ok({ success: true, devResetToken });
  } catch (err) {
    return handleError(err);
  }
}
