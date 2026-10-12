import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { faqSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("faq");
    const { id } = await params;
    const input = faqSchema.parse(await req.json());
    const existing = await db.faqEntry.findUnique({ where: { id } });
    if (!existing) return fail("FAQ entry not found.", 404);
    await db.faqEntry.update({ where: { id }, data: input });
    await audit(staff, "FAQ_UPDATE", "FaqEntry", id);
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("faq");
    const { id } = await params;
    await db.faqEntry.delete({ where: { id } });
    await audit(staff, "FAQ_DELETE", "FaqEntry", id);
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
