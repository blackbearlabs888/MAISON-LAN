import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { contentPageSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

export async function GET() {
  try {
    await requireStaff("pages");
    const pages = await db.contentPage.findMany({ orderBy: { updatedAt: "desc" } });
    return ok({ pages });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff("pages");
    const input = contentPageSchema.parse(await req.json());
    const page = await db.contentPage.create({
      data: {
        title: input.title,
        slug: input.slug,
        content: input.content,
        isPublished: input.isPublished,
        showInFooter: input.showInFooter,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
      },
    });
    await audit(staff, "PAGE_CREATE", "ContentPage", page.id, { title: page.title });
    return ok({ page }, 201);
  } catch (err) {
    return handleError(err);
  }
}
