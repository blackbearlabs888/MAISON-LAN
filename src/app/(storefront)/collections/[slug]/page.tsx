import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/store-settings";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";

export const dynamic = "force-dynamic";

async function getCategory(slug: string) {
  return db.category.findUnique({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug).catch(() => null);
  if (!category) return { title: "Collection" };
  return {
    title: category.name,
    description: category.description ?? `Discover the ${category.name} collection.`,
    openGraph: category.imageUrl ? { images: [category.imageUrl] } : undefined,
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category || !category.isActive) notFound();

  const settings = await getStoreSettings();
  const products = await db.product.findMany({
    where: { isActive: true, archivedAt: null, categories: { some: { categoryId: category.id } } },
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      categories: { include: { category: true } },
      variants: { select: { stock: true } },
    },
  });
  const cards: ProductCardData[] = products.map((p) => ({
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

  return (
    <div className="fade-up">
      {/* collection hero */}
      <section className="relative h-[38vh] min-h-[280px] overflow-hidden bg-secondary">
        {category.imageUrl && (
          <Image src={category.imageUrl} alt={category.name} fill priority sizes="100vw" className="object-cover" />
        )}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/85">Collection</p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl">{category.name}</h1>
            {category.description && (
              <p className="mx-auto mt-3 max-w-md px-4 text-sm font-light text-white/90">
                {category.description}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        {cards.length === 0 ? (
          <div className="border border-dashed border-border py-20 text-center">
            <p className="font-display text-2xl">This collection is resting</p>
            <p className="mt-3 text-sm font-light text-muted-foreground">
              New pieces are on their way. Explore everything in the boutique meanwhile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {cards.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                currency={settings.currency}
                locale={settings.locale}
                priority={i < 4}
                lowStockThreshold={settings.lowStockThreshold}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
