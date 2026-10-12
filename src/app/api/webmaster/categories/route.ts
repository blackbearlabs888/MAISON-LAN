import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { categorySchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

export async function GET() {
  try {
    await requireStaff("categories");
    const categories = await db.category.findMany({
      orderBy: { position: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return ok({ categories });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff("categories");
    const input = categorySchema.parse(await req.json());
    const category = await db.category.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        imageUrl: input.imageUrl || null,
        position: input.position,
        isActive: input.isActive,
      },
    });
    await audit(staff, "CATEGORY_CREATE", "Category", category.id, { name: category.name });
    return ok({ category }, 201);
  } catch (err) {
    return handleError(err);
  }
}
