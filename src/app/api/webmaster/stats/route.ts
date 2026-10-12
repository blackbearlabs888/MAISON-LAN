import { db } from "@/lib/db";
import { requireStaff } from "../helpers";
import { ok, handleError } from "@/lib/api-helpers";
import { telegramConfigured } from "@/lib/telegram";

// GET /api/webmaster/stats — dashboard KPIs.
// Revenue counts only eligible statuses (PAID..COMPLETED) — never pending/cancelled.
export async function GET() {
  try {
    await requireStaff("orders");

    const revenueStatuses = ["PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "COMPLETED"];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalOrders,
      pendingOrders,
      toShip,
      revenueAgg,
      monthRevenueAgg,
      lastMonthRevenueAgg,
      recentOrders,
      bestSellers,
      lowStock,
      lastDeliveries,
      customerCount,
      productCount,
    ] = await Promise.all([
      db.order.count(),
      db.order.count({ where: { status: "PENDING_PAYMENT" } }),
      db.order.count({ where: { status: { in: ["PAID", "PROCESSING", "READY_TO_SHIP"] } } }),
      db.order.aggregate({ _sum: { totalCents: true }, where: { status: { in: revenueStatuses } } }),
      db.order.aggregate({
        _sum: { totalCents: true },
        where: { status: { in: revenueStatuses }, createdAt: { gte: startOfMonth } },
      }),
      db.order.aggregate({
        _sum: { totalCents: true },
        where: { status: { in: revenueStatuses }, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      }),
      db.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          totalCents: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
      db.orderItem.groupBy({
        by: ["productId", "name"],
        _sum: { quantity: true },
        _count: { productId: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
        where: { productId: { not: null } },
      }),
      db.productVariant.findMany({
        where: { product: { isActive: true, archivedAt: null } },
        select: { id: true, sku: true, stock: true, size: true, color: true, product: { select: { name: true } } },
        orderBy: { stock: "asc" },
        take: 8,
      }),
      db.notificationDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.product.count({ where: { archivedAt: null } }),
    ]);

    // 14-day sales trend (eligible revenue per day)
    const since = new Date(now.getTime() - 13 * 24 * 3600 * 1000);
    const trendOrders = await db.order.findMany({
      where: { status: { in: revenueStatuses }, createdAt: { gte: since } },
      select: { createdAt: true, totalCents: true },
    });
    const trend: { date: string; revenue: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(day.getTime() + 24 * 3600 * 1000);
      const revenue = trendOrders
        .filter((o) => o.createdAt >= day && o.createdAt < next)
        .reduce((s, o) => s + o.totalCents, 0);
      trend.push({ date: day.toISOString().slice(0, 10), revenue: revenue / 100 });
    }

    const failedCount = lastDeliveries.filter((d) => d.status === "FAILED").length;
    const sentCount = lastDeliveries.filter((d) => d.status === "SENT").length;
    const telegramHealth = !(await telegramConfigured())
      ? "NOT_CONFIGURED"
      : failedCount > 0 && sentCount === 0
        ? "FAILING"
        : failedCount > 0
          ? "DEGRADED"
          : "HEALTHY";

    return ok({
      stats: {
        totalOrders,
        pendingOrders,
        toShip,
        revenueCents: revenueAgg._sum.totalCents ?? 0,
        monthRevenueCents: monthRevenueAgg._sum.totalCents ?? 0,
        lastMonthRevenueCents: lastMonthRevenueAgg._sum.totalCents ?? 0,
        customerCount,
        productCount,
      },
      recentOrders,
      bestSellers: bestSellers.map((b) => ({ name: b.name, quantity: b._sum.quantity ?? 0 })),
      lowStock,
      trend,
      telegramHealth,
      notifications: lastDeliveries.slice(0, 5),
    });
  } catch (err) {
    return handleError(err);
  }
}
