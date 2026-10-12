import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/store-settings";
import { effectiveUnitPriceCents } from "@/lib/money";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Browse the full collection — handbags, jewelry, apparel, accessories and fragrance.",
};

interface SearchParams {
  q?: string;
  category?: string;
  min?: string;
  max?: string;
  availability?: string;
  sort?: string;
  page?: string;
}

const PAGE_SIZE = 9;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const settings = await getStoreSettings();

  const q = (sp.q ?? "").trim();
  const categorySlug = sp.category ?? "";
  const minPrice = sp.min ? Number(sp.min) : null;
  const maxPrice = sp.max ? Number(sp.max) : null;
  const availability = sp.availability ?? "";
  const sort = sp.sort ?? "newest";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const activeCategory = categorySlug
    ? categories.find((c) => c.slug === categorySlug) ?? null
    : null;

  const where: Record<string, unknown> = {
    isActive: true,
    archivedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
            { material: { contains: q } },
          ],
        }
      : {}),
    ...(activeCategory ? { categories: { some: { categoryId: activeCategory.id } } } : {}),
  };

  const rawProducts = await db.product.findMany({
    where,
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      categories: { include: { category: true } },
      variants: { select: { stock: true } },
    },
  });

  // Map to cards first so we can filter/sort on effective price in memory
  // (SQLite lacks decimal filtering; dataset sizes for boutique stores are small).
  let cards: ProductCardData[] = rawProducts.map((p) => ({
    id: p.id,
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
  }));

  if (minPrice != null && Number.isFinite(minPrice)) {
    cards = cards.filter((c) => effectiveUnitPriceCents(c) >= minPrice * 100);
  }
  if (maxPrice != null && Number.isFinite(maxPrice) && maxPrice > 0) {
    cards = cards.filter((c) => effectiveUnitPriceCents(c) <= maxPrice * 100);
  }
  if (availability === "in-stock") cards = cards.filter((c) => c.totalStock > 0);
  if (availability === "on-sale") {
    cards = cards.filter((c) => c.salePriceCents != null && c.salePriceCents < c.priceCents);
  }

  switch (sort) {
    case "price-asc":
      cards.sort((a, b) => effectiveUnitPriceCents(a) - effectiveUnitPriceCents(b));
      break;
    case "price-desc":
      cards.sort((a, b) => effectiveUnitPriceCents(b) - effectiveUnitPriceCents(a));
      break;
    case "name":
      cards.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "popular":
      cards.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller));
      break;
    case "newest":
    default:
      // already newest-first from query; stable
      break;
  }

  const total = cards.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const paged = cards.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categorySlug) params.set("category", categorySlug);
    if (sp.min) params.set("min", sp.min);
    if (sp.max) params.set("max", sp.max);
    if (availability) params.set("availability", availability);
    if (sort) params.set("sort", sort);
    params.set("page", String(p));
    return `/products?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* heading */}
      <div className="border-b border-border pb-8 text-center">
        <p className="editorial-label text-muted-foreground">
          {q ? "Search results" : activeCategory ? "Collection" : "The boutique"}
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">
          {q ? `“${q}”` : activeCategory ? activeCategory.name : "All pieces"}
        </h1>
        <p className="mt-3 text-sm font-light text-muted-foreground">
          {total} {total === 1 ? "piece" : "pieces"}
          {q && " found"}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row">
        {/* filters */}
        <aside className="lg:w-56 lg:shrink-0">
          <CatalogFilters
            categories={categories}
            current={{
              q,
              category: categorySlug,
              min: sp.min ?? "",
              max: sp.max ?? "",
              availability,
              sort,
            }}
          />
        </aside>

        {/* grid */}
        <section className="flex-1" aria-label="Product grid">
          {paged.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-border py-24 text-center">
              <p className="font-display text-2xl">Nothing here — yet</p>
              <p className="mt-3 max-w-sm text-sm font-light text-muted-foreground">
                {q
                  ? `No pieces match “${q}”. Try a different search or clear the filters.`
                  : "No pieces match the selected filters. Try adjusting your selection."}
              </p>
              <Link
                href="/products"
                className="editorial-label mt-8 border-b border-foreground pb-1 hover:opacity-60"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 xl:grid-cols-3">
                {paged.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    currency={settings.currency}
                    locale={settings.locale}
                    priority={i < 3}
                    lowStockThreshold={settings.lowStockThreshold}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="mt-14 flex items-center justify-center gap-2" aria-label="Pagination">
                  {current > 1 && (
                    <Link href={pageHref(current - 1)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                      ←
                    </Link>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={pageHref(p)}
                      aria-current={p === current ? "page" : undefined}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center text-sm transition-colors",
                        p === current
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p}
                    </Link>
                  ))}
                  {current < totalPages && (
                    <Link href={pageHref(current + 1)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                      →
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
