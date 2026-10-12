import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { bannerSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("banners");
    const { id } = await params;
    const input = bannerSchema.parse(await req.json());
    const existing = await db.banner.findUnique({ where: { id } });
    if (!existing) return fail("Banner not found.", 404);
    await db.banner.update({
      where: { id },
      data: {
        title: input.title,
        subtitle: input.subtitle || null,
        imageUrl: input.imageUrl,
        mobileImageUrl: input.mobileImageUrl || null,
        ctaText: input.ctaText || null,
        ctaUrl: input.ctaUrl || null,
        position: input.position,
        isActive: input.isActive,
      },
    });
    await audit(staff, "BANNER_UPDATE", "Banner", id, { title: input.title });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("banners");
    const { id } = await params;
    await db.banner.delete({ where: { id } });
    await audit(staff, "BANNER_DELETE", "Banner", id);
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
