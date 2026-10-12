import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { courierSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

export async function GET() {
  try {
    await requireStaff("shipping");
    const couriers = await db.courier.findMany({
      orderBy: { position: "asc" },
      include: { rates: { orderBy: { rateCents: "asc" } }, _count: { select: { rates: true } } },
    });
    return ok({ couriers });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff("shipping");
    const input = courierSchema.parse(await req.json());
    const courier = await db.courier.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description || null,
        trackingUrlTemplate: input.trackingUrlTemplate || null,
        minDays: input.minDays ?? null,
        maxDays: input.maxDays ?? null,
        isActive: input.isActive,
        position: input.position,
      },
    });
    await audit(staff, "COURIER_CREATE", "Courier", courier.id, { name: courier.name });
    return ok({ courier }, 201);
  } catch (err) {
    return handleError(err);
  }
}
