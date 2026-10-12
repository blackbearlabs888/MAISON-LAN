import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { categorySchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("categories");
    const { id } = await params;
    const input = categorySchema.parse(await req.json());
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) return fail("Category not found.", 404);
    await db.category.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        imageUrl: input.imageUrl || null,
        position: input.position,
        isActive: input.isActive,
      },
    });
    await audit(staff, "CATEGORY_UPDATE", "Category", id, { name: input.name });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("categories");
    const { id } = await params;
    await db.category.delete({ where: { id } }); // join rows cascade
    await audit(staff, "CATEGORY_DELETE", "Category", id);
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
