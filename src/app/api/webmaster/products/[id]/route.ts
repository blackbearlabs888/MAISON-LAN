import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { productSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";

type Params = { params: Promise<{ id: string }> };

// GET single product (full editor payload).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireStaff("products");
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
        categories: { select: { categoryId: true } },
      },
    });
    if (!product) return fail("Product not found.", 404);
    return ok({
      product: {
        ...product,
        categoryIds: product.categories.map((c) => c.categoryId),
        categories: undefined,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

// PUT — full update; replaces images/categories, upserts variants by id.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("products");
    const { id } = await params;
    const input = productSchema.parse(await req.json());

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return fail("Product not found.", 404);

    await db.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: input.images.map((img, i) => ({
          productId: id,
          url: img.url,
          alt: img.alt || null,
          position: i,
        })),
      });

      await tx.productCategory.deleteMany({ where: { productId: id } });
      if (input.categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: input.categoryIds.map((categoryId) => ({ productId: id, categoryId })),
        });
      }

      const keepIds = input.variants.filter((v) => v.id).map((v) => v.id!);
      await tx.productVariant.deleteMany({
        where: { productId: id, id: { notIn: keepIds } },
      });
      for (const v of input.variants) {
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              size: v.size || null,
              color: v.color || null,
              sku: v.sku,
              stock: v.stock,
              priceDeltaCents: v.priceDeltaCents,
            },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId: id,
              size: v.size || null,
              color: v.color || null,
              sku: v.sku,
              stock: v.stock,
              priceDeltaCents: v.priceDeltaCents,
            },
          });
        }
      }

      await tx.product.update({
        where: { id },
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          details: input.details || null,
          priceCents: input.priceCents,
          salePriceCents: input.salePriceCents ?? null,
          skuBase: input.skuBase,
          material: input.material || null,
          isFeatured: input.isFeatured,
          isNewArrival: input.isNewArrival,
          isBestSeller: input.isBestSeller,
          isActive: input.isActive,
        },
      });
    });

    await audit(staff, "PRODUCT_UPDATE", "Product", id, { name: input.name });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE — archive (soft) when referenced by orders; hard delete only if never sold.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("products");
    const { id } = await params;
    const hard = req.nextUrl.searchParams.get("hard") === "true";

    const orderRefCount = await db.orderItem.count({ where: { productId: id } });
    if (orderRefCount > 0 || !hard) {
      await db.product.update({
        where: { id },
        data: { archivedAt: new Date(), isActive: false },
      });
      await audit(staff, "PRODUCT_ARCHIVE", "Product", id);
      return ok({ archived: true });
    }

    await db.product.delete({ where: { id } });
    await audit(staff, "PRODUCT_DELETE", "Product", id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
