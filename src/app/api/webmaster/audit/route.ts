import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

// GET /api/webmaster/audit — audit trail (OWNER/ADMIN).
export async function GET() {
  try {
    await requireStaff("audit");
    const logs = await db.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({ logs });
  } catch (err) {
    return handleError(err);
  }
}
