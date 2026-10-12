import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api-helpers";
import { effectiveUnitPriceCents } from "@/lib/money";
import { getStoreSettings } from "@/lib/store-settings";
import { z } from "zod";

const schema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .max(50),
});

// Server-side cart revalidation: fresh prices + stock for the client cart.
export async function POST(req: NextRequest) {
  try {
    const { items } = schema.parse(await req.json());
    const settings = await getStoreSettings();

    const variants = await db.productVariant.findMany({
      where: { id: { in: items.map((i) => i.variantId) } },
      include: { product: true },
    });

    const fresh = items
      .map((i) => {
        const v = variants.find((x) => x.id === i.variantId);
        if (!v || v.product.archivedAt || !v.product.isActive) return null;
        const capped = settings.enforceStock ? Math.min(i.quantity, v.stock) : i.quantity;
        if (settings.enforceStock && v.stock <= 0) return null;
        return {
          variantId: v.id,
          unitPriceCents: effectiveUnitPriceCents(v.product) + v.priceDeltaCents,
          maxStock: settings.enforceStock ? v.stock : 999,
          quantity: capped,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return ok({ items: fresh, enforceStock: settings.enforceStock });
  } catch (err) {
    return handleError(err);
  }
}
