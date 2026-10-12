import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { shippingRateSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

export async function GET(req: NextRequest) {
  try {
    await requireStaff("shipping");
    const courierId = req.nextUrl.searchParams.get("courierId");
    const rates = await db.shippingRate.findMany({
      where: courierId ? { courierId } : undefined,
      orderBy: { rateCents: "asc" },
      include: { courier: { select: { name: true } } },
    });
    return ok({ rates });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff("shipping");
    const input = shippingRateSchema.parse(await req.json());
    const courier = await db.courier.findUnique({ where: { id: input.courierId } });
    if (!courier) return ok({ error: "Courier not found." }, 404);

    const rate = await db.shippingRate.create({
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
    await audit(staff, "RATE_CREATE", "ShippingRate", rate.id, {
      courier: courier.name,
      name: rate.name,
      rateCents: rate.rateCents,
    });
    return ok({ rate }, 201);
  } catch (err) {
    return handleError(err);
  }
}
