import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { customerAdminSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";

type Params = { params: Promise<{ id: string }> };

// GET — customer detail with their orders (never exposes secrets).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireStaff("customers");
    const { id } = await params;
    const customer = await db.user.findFirst({
      where: { id, role: "CUSTOMER" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!customer) return fail("Customer not found.", 404);

    const orders = await db.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalCents: true,
        createdAt: true,
      },
    });
    return ok({ customer, orders });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH — disable / reactivate account.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("customers");
    const { id } = await params;
    const input = customerAdminSchema.parse(await req.json());

    const customer = await db.user.findFirst({ where: { id, role: "CUSTOMER" } });
    if (!customer) return fail("Customer not found.", 404);

    await db.user.update({ where: { id }, data: { isActive: input.isActive } });
    if (input.isActive === false) {
      await db.session.deleteMany({ where: { userId: id } }); // kill active sessions
    }
    await audit(staff, input.isActive ? "CUSTOMER_REACTIVATE" : "CUSTOMER_DISABLE", "User", id);

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
