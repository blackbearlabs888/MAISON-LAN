import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { contentPageSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("pages");
    const { id } = await params;
    const input = contentPageSchema.parse(await req.json());
    const existing = await db.contentPage.findUnique({ where: { id } });
    if (!existing) return fail("Page not found.", 404);
    await db.contentPage.update({
      where: { id },
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
    await audit(staff, "PAGE_UPDATE", "ContentPage", id, { title: input.title });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("pages");
    const { id } = await params;
    await db.contentPage.delete({ where: { id } });
    await audit(staff, "PAGE_DELETE", "ContentPage", id);
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
