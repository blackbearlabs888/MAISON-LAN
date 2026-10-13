import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/api-helpers";

// DELETE /api/wishlist/[productId] — remove one product from the wishlist.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await requireUser();
    const { productId } = await params;

    await db.wishlistItem.deleteMany({
      where: { userId: user.id, productId },
    });

    return ok({ removed: true });
  } catch (err) {
    return handleError(err);
  }
}
