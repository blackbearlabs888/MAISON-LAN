import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { faqSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

export async function GET() {
  try {
    await requireStaff("faq");
    const entries = await db.faqEntry.findMany({ orderBy: { position: "asc" } });
    return ok({ entries });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff("faq");
    const input = faqSchema.parse(await req.json());
    const entry = await db.faqEntry.create({ data: input });
    await audit(staff, "FAQ_CREATE", "FaqEntry", entry.id);
    return ok({ entry }, 201);
  } catch (err) {
    return handleError(err);
  }
}
