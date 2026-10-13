import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/api-helpers";

// GET /api/wishlist/ids — lightweight product-id list for heart-state sync.
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.wishlistItem.findMany({
      where: { userId: user.id },
      select: { productId: true },
    });
    return ok({ ids: rows.map((r) => r.productId) });
  } catch (err) {
    return handleError(err);
  }
}
