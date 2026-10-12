import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addressSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requireUser();
    const addresses = await db.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return ok({ addresses });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = addressSchema.parse(await req.json());

    if (input.isDefault) {
      await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }
    const count = await db.address.count({ where: { userId: user.id } });
    const address = await db.address.create({
      data: {
        userId: user.id,
        label: input.label || null,
        fullName: input.fullName,
        phone: input.phone,
        line1: input.line1,
        line2: input.line2 || null,
        city: input.city,
        province: input.province,
        postalCode: input.postalCode,
        country: input.country,
        isDefault: input.isDefault || count === 0,
      },
    });
    return ok({ address }, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const id = String(body.id ?? "");
    const address = await db.address.findUnique({ where: { id } });
    if (!address || address.userId !== user.id) return fail("Address not found.", 404);

    if (body.isDefault) {
      await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      await db.address.update({ where: { id }, data: { isDefault: true } });
    }
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const address = await db.address.findUnique({ where: { id } });
    if (!address || address.userId !== user.id) return fail("Address not found.", 404);
    await db.address.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
