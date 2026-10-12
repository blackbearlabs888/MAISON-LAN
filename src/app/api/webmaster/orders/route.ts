import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

// GET /api/webmaster/orders — list with filters (status, payment, search, date).
export async function GET(req: NextRequest) {
  try {
    await requireStaff("orders");
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ?? "";
    const payment = sp.get("payment") ?? "";
    const q = sp.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
    const pageSize = 15;

    const where = {
      ...(status ? { status } : {}),
      ...(payment ? { paymentStatus: payment } : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q } },
              { customerName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      db.order.count({ where }),
      db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: { take: 3, select: { name: true, quantity: true } },
          shipment: { select: { trackingNumber: true, status: true, courierName: true } },
        },
      }),
    ]);

    return ok({ total, page, pageSize, orders });
  } catch (err) {
    return handleError(err);
  }
}
