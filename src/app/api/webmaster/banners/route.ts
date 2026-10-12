import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { bannerSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

export async function GET() {
  try {
    await requireStaff("banners");
    const banners = await db.banner.findMany({ orderBy: { position: "asc" } });
    return ok({ banners });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff("banners");
    const input = bannerSchema.parse(await req.json());
    const banner = await db.banner.create({
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
    await audit(staff, "BANNER_CREATE", "Banner", banner.id, { title: banner.title });
    return ok({ banner }, 201);
  } catch (err) {
    return handleError(err);
  }
}
