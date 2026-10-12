import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { newsletterSchema } from "@/lib/validators";
import { ok, handleError, clientIp } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(`newsletter:${clientIp(req)}`, { limit: 6, windowMs: 60_000 });
    if (!limited.ok) return ok({ success: true }); // silent

    const { email } = newsletterSchema.parse(await req.json());
    await db.newsletterSubscriber.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: { email: email.toLowerCase() },
    });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
