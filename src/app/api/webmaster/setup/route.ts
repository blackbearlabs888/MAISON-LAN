import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength, createSession, audit } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { ok, fail, handleError, clientIp } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/webmaster/setup — bootstrap the FIRST owner account.
// Only available while zero OWNER accounts exist. No default credentials ship
// with the product (DECISIONS D-08).
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(`setup:${clientIp(req)}`, { limit: 5, windowMs: 300_000 });
    if (!limited.ok) return fail("Too many attempts. Please wait.", 429);

    const ownerCount = await db.user.count({ where: { role: "OWNER" } });
    if (ownerCount > 0) {
      return fail("An owner account already exists. Sign in instead.", 409);
    }

    const body = await req.json();
    const input = registerSchema.parse(body);

    const pwError = validatePasswordStrength(input.password);
    if (pwError) return fail(pwError, 422);

    const email = input.email.toLowerCase().trim();
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) return fail("An account with this email already exists.", 409);

    const user = await db.user.create({
      data: {
        email,
        passwordHash: await hashPassword(input.password),
        name: input.name.trim(),
        phone: input.phone || null,
        role: "OWNER",
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await createSession(user.id);
    await audit(
      { id: user.id, email: user.email, name: user.name, role: "OWNER", phone: null },
      "OWNER_BOOTSTRAP",
      "User",
      user.id
    );

    return ok({ user }, 201);
  } catch (err) {
    return handleError(err);
  }
}

// GET — reports whether setup is still open (for the /webmaster/setup page).
export async function GET() {
  try {
    const ownerCount = await db.user.count({ where: { role: "OWNER" } });
    return ok({ setupRequired: ownerCount === 0 });
  } catch (err) {
    return handleError(err);
  }
}
