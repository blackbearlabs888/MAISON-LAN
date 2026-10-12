import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

// GET /api/webmaster/customers — paged list with search.
export async function GET(req: NextRequest) {
  try {
    await requireStaff("customers");
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
    const pageSize = 15;

    const where = {
      role: "CUSTOMER" as const,
      ...(q
        ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
        : {}),
    };

    const [total, customers] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          isActive: true,
          createdAt: true,
          // passwordHash is NEVER selected (spec §9.G)
          _count: { select: { orders: true } },
        },
      }),
    ]);

    const withSpend = await Promise.all(
      customers.map(async (c) => {
        const agg = await db.order.aggregate({
          _sum: { totalCents: true },
          where: {
            userId: c.id,
            status: { in: ["PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "COMPLETED"] },
          },
        });
        return { ...c, orderCount: c._count.orders, totalSpentCents: agg._sum.totalCents ?? 0, _count: undefined };
      })
    );

    return ok({ total, page, pageSize, customers: withSpend });
  } catch (err) {
    return handleError(err);
  }
}
