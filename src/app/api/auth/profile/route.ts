import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { profileUpdateSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api-helpers";

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = profileUpdateSchema.parse(await req.json());
    const updated = await db.user.update({
      where: { id: user.id },
      data: { name: input.name.trim(), phone: input.phone || null },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
    return ok({ user: updated });
  } catch (err) {
    return handleError(err);
  }
}
