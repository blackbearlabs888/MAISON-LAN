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

    const body = await req.json();
    const input = registerSchema.parse(body);

    const pwError = validatePasswordStrength(input.password);
    if (pwError) return fail(pwError, 422);

    const email = input.email.toLowerCase().trim();

    // Bootstrap is only possible while zero OWNER accounts exist. The check and
    // the create share one transaction (audit A-08). On SQLite the single-writer
    // lock fully serializes concurrent bootstraps. On PostgreSQL (READ COMMITTED)
    // a transaction alone is NOT enough — two concurrent first-run submissions
    // could both observe ownerCount=0 and both create an OWNER. A transaction-
    // scoped advisory lock (S-02) serializes the critical section on Postgres;
    // the loser re-reads the count after acquiring the lock and gets a 409.
    const result = await db.$transaction(async (tx) => {
      if ((process.env.DATABASE_URL ?? "").startsWith("postgres")) {
        // 742191117 = arbitrary, stable lock id reserved for owner bootstrap.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(742191117)`;
      }
      const ownerCount = await tx.user.count({ where: { role: "OWNER" } });
      if (ownerCount > 0) return null;

      const exists = await tx.user.findUnique({ where: { email } });
      if (exists) return null;

      return tx.user.create({
        data: {
          email,
          passwordHash: await hashPassword(input.password),
          name: input.name.trim(),
          phone: input.phone || null,
          role: "OWNER",
        },
        select: { id: true, email: true, name: true, role: true },
      });
    });

    if (!result) {
      // Distinguish the two reasons for a null result.
      const taken = await db.user.findUnique({ where: { email } });
      return fail(
        taken
          ? "An account with this email already exists."
          : "An owner account already exists. Sign in instead.",
        409
      );
    }
    const user = result;

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
