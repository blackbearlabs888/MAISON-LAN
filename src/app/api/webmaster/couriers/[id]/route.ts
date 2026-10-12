import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { courierSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("shipping");
    const { id } = await params;
    const input = courierSchema.parse(await req.json());
    const existing = await db.courier.findUnique({ where: { id } });
    if (!existing) return fail("Courier not found.", 404);

    await db.courier.update({
      where: { id },
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
    await audit(staff, "COURIER_UPDATE", "Courier", id, { name: input.name });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("shipping");
    const { id } = await params;
    const refCount = await db.shipment.count({ where: { courierId: id } });
    if (refCount > 0) {
      await db.courier.update({ where: { id }, data: { isActive: false } });
      await audit(staff, "COURIER_DEACTIVATE", "Courier", id, { reason: "referenced by shipments" });
      return ok({ deactivated: true, message: "Courier is referenced by shipments and was deactivated instead of deleted." });
    }
    await db.courier.delete({ where: { id } });
    await audit(staff, "COURIER_DELETE", "Courier", id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
