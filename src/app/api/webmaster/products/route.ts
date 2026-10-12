import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { productSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../helpers";

// GET /api/webmaster/products — paged list with search + status filter.
export async function GET(req: NextRequest) {
  try {
    await requireStaff("products");
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() ?? "";
    const status = sp.get("status") ?? "active"; // active | archived | all
    const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
    const pageSize = 15;

    const where = {
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { skuBase: { contains: q } },
              { slug: { contains: q } },
            ],
          }
        : {}),
      ...(status === "active" ? { archivedAt: null } : status === "archived" ? { archivedAt: { not: null } } : {}),
    };

    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          images: { orderBy: { position: "asc" }, take: 1 },
          variants: { select: { stock: true } },
          categories: { include: { category: { select: { name: true } } } },
        },
      }),
    ]);

    return ok({
      total,
      page,
      pageSize,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        skuBase: p.skuBase,
        priceCents: p.priceCents,
        salePriceCents: p.salePriceCents,
        isActive: p.isActive,
        archivedAt: p.archivedAt,
        image: p.images[0]?.url ?? null,
        totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
        variantCount: p.variants.length,
        categories: p.categories.map((c) => c.category.name),
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/webmaster/products — create product with images/variants/categories.
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff("products");
    const input = productSchema.parse(await req.json());

    const product = await db.product.create({
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
        images: {
          create: input.images.map((img, i) => ({
            url: img.url,
            alt: img.alt || null,
            position: i,
          })),
        },
        variants: {
          create: input.variants.map((v) => ({
            size: v.size || null,
            color: v.color || null,
            sku: v.sku,
            stock: v.stock,
            priceDeltaCents: v.priceDeltaCents,
          })),
        },
        categories: {
          create: input.categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: { variants: true },
    });

    await audit(staff, "PRODUCT_CREATE", "Product", product.id, { name: product.name });
    return ok({ product }, 201);
  } catch (err) {
    return handleError(err);
  }
}
