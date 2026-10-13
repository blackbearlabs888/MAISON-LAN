import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { wishlistAddSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";

// GET /api/wishlist — the signed-in customer's saved products, newest first.
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.wishlistItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          include: {
            images: { orderBy: { position: "asc" }, take: 1 },
            categories: { include: { category: true } },
            variants: { select: { stock: true } },
          },
        },
      },
    });

    const items = rows
      .filter((r) => r.product.isActive && !r.product.archivedAt)
      .map((r) => {
        const p = r.product;
        return {
          id: r.id,
          productId: p.id,
          addedAt: r.createdAt.toISOString(),
          name: p.name,
          slug: p.slug,
          priceCents: p.priceCents,
          salePriceCents: p.salePriceCents,
          imageUrl: p.images[0]?.url ?? null,
          imageAlt: p.images[0]?.alt ?? p.name,
          isNewArrival: p.isNewArrival,
          isBestSeller: p.isBestSeller,
          totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
          categoryName: p.categories[0]?.category.name ?? null,
        };
      });

    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/wishlist { productId } — add (idempotent).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { productId } = wishlistAddSchema.parse(await req.json());

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, archivedAt: true },
    });
    if (!product || !product.isActive || product.archivedAt) {
      return fail("Product not found.", 404);
    }

    await db.wishlistItem.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      update: {},
      create: { userId: user.id, productId },
    });

    return ok({ added: true });
  } catch (err) {
    return handleError(err);
  }
}
