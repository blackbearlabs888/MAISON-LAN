import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

// GET /api/webmaster/notifications — delivery log (attempts, errors, health).
export async function GET() {
  try {
    await requireStaff("notifications");
    const deliveries = await db.notificationDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    const sent = await db.notificationDelivery.count({ where: { status: "SENT" } });
    const failed = await db.notificationDelivery.count({ where: { status: "FAILED" } });
    const pending = await db.notificationDelivery.count({ where: { status: "PENDING" } });
    return ok({ deliveries, counters: { sent, failed, pending } });
  } catch (err) {
    return handleError(err);
  }
}
