import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { shippingRateSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("shipping");
    const { id } = await params;
    const input = shippingRateSchema.parse(await req.json());
    const existing = await db.shippingRate.findUnique({ where: { id } });
    if (!existing) return fail("Rate not found.", 404);

    await db.shippingRate.update({
      where: { id },
      data: {
        courierId: input.courierId,
        name: input.name,
        type: input.type,
        region: input.type === "REGION" ? input.region || "*" : "*",
        rateCents: input.rateCents,
        freeAboveCents: input.freeAboveCents ?? null,
        isActive: input.isActive,
      },
    });
    await audit(staff, "RATE_UPDATE", "ShippingRate", id, { name: input.name });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("shipping");
    const { id } = await params;
    await db.shippingRate.delete({ where: { id } });
    await audit(staff, "RATE_DELETE", "ShippingRate", id);
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
