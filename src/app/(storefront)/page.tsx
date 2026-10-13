import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/store-settings";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import { HeroCarousel } from "@/components/storefront/hero-carousel";

export const dynamic = "force-dynamic";

async function getProductCards(
  where: Record<string, unknown>,
  take: number
): Promise<ProductCardData[]> {
  const products = await db.product.findMany({
    where: { isActive: true, archivedAt: null, ...where },
    take,
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      categories: { include: { category: true } },
      variants: { select: { stock: true } },
    },
  });
  return products.map((p) => ({
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
}

export default async function HomePage() {
  const settings = await getStoreSettings();
  const currency = settings.currency;
  const locale = settings.locale;

  const [banners, categories, newArrivals, bestSellers] = await Promise.all([
    db.banner
      .findMany({ where: { isActive: true }, orderBy: { position: "asc" }, take: 5 })
      .catch(() => []),
    db.category
      .findMany({ where: { isActive: true }, orderBy: { position: "asc" }, take: 5 })
      .catch(() => []),
    settings.homepage.showNewArrivals
      ? getProductCards({ isNewArrival: true }, 4).catch(() => [])
      : Promise.resolve([]),
    settings.homepage.showBestSellers
      ? getProductCards({ isBestSeller: true }, 4).catch(() => [])
      : Promise.resolve([]),
  ]);

  const activeBanners = banners.filter(
    (b) =>
      (!b.startsAt || b.startsAt <= new Date()) && (!b.endsAt || b.endsAt >= new Date())
  );

  const slides =
    activeBanners.length > 0
      ? activeBanners.map((b) => ({
          title: b.title,
          subtitle: b.subtitle ?? settings.homepage.heroSubline,
          ctaText: b.ctaText ?? "Discover",
          ctaUrl: b.ctaUrl ?? "/products",
          imageUrl: b.imageUrl,
        }))
      : [
          {
            title: settings.homepage.heroHeadline,
            subtitle: settings.homepage.heroSubline,
            ctaText: "Shop the collection",
            ctaUrl: "/products",
            imageUrl: "/images/hero-1.jpg",
          },
          {
            title: "Objects of intent",
            subtitle: "Hand-finished leather goods, made in small series.",
            ctaText: "Explore handbags",
            ctaUrl: "/collections/handbags",
            imageUrl: "/images/hero-2.jpg",
          },
        ];

  return (
    <div className="fade-up">
      {/* ── Hero ── */}
      <section aria-label="Featured campaign">
        <HeroCarousel slides={slides} />
      </section>

      {/* ── Value strip ── */}
      <section className="border-b border-border bg-[#f3efe7] dark:bg-[#211d17]" aria-label="Store services">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 text-center sm:grid-cols-3 sm:px-6">
          {[
            { t: "Complimentary shipping", d: "On orders above the threshold — tracked to your door." },
            { t: "Verified before dispatch", d: "Every piece is inspected and wrapped by hand." },
            { t: "Considered service", d: "Care team reachable on business days, 9–18 WIB." },
          ].map((v) => (
            <div key={v.t}>
              <p className="editorial-label">{v.t}</p>
              <p className="mx-auto mt-1.5 max-w-[26ch] text-[13px] font-light text-muted-foreground">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories ── */}
      {settings.homepage.showCategories && categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-label="Collections">
          <div className="flex items-end justify-between">
            <div>
              <p className="editorial-label text-muted-foreground">The Collections</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Explore the house</h2>
            </div>
            <Link href="/products" className="lux-underline hidden items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] sm:inline-flex">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {categories.slice(0, 5).map((c, i) => (
              <Link
                key={c.id}
                href={`/collections/${c.slug}`}
                className="group relative block aspect-[3/4] overflow-hidden bg-secondary"
              >
                {c.imageUrl && (
                  <Image
                    src={c.imageUrl}
                    alt={c.name}
                    fill
                    priority={i < 2}
                    sizes="(max-width: 768px) 50vw, 20vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="font-display text-lg leading-tight">{c.name}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/80">Discover</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── New arrivals ── */}
      {newArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6" aria-label="New arrivals">
          <div className="flex items-end justify-between">
            <div>
              <p className="editorial-label text-muted-foreground">Just arrived</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">New in</h2>
            </div>
            <Link href="/products?sort=newest" className="lux-underline hidden items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] sm:inline-flex">
              Shop new <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {newArrivals.map((p, i) => (
              <ProductCard key={p.id} product={p} currency={currency} locale={locale} priority={i < 2} />
            ))}
          </div>
        </section>
      )}

      {/* ── Editorial ── */}
      {settings.homepage.showEditorial && (
        <section className="border-y border-border bg-[#f3efe7] dark:bg-[#211d17]" aria-label="Editorial">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src="/images/editorial-1.jpg"
                alt="Artisan hands stitching leather in the atelier"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="lg:pr-8">
              <p className="editorial-label text-muted-foreground">The Atelier</p>
              <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
                Made slowly.
                <br />
                Worn always.
              </h2>
              <p className="mt-5 max-w-lg text-[15px] font-light leading-relaxed text-muted-foreground">
                Each season, our atelier releases a small series of considered pieces — vegetable-tanned
                leathers, mulberry silks and recycled gold. Nothing mass-produced, nothing disposable.
                Read how a MAISON ÉLAN piece comes to life, from pattern to final stitch.
              </p>
              <div className="mt-8 flex gap-8">
                <Link href="/pages/about-us" className="editorial-label border-b border-foreground pb-1 transition-opacity hover:opacity-60">
                  Our story
                </Link>
                <Link href="/products" className="editorial-label border-b border-foreground pb-1 transition-opacity hover:opacity-60">
                  Shop the craft
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Best sellers ── */}
      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-label="Best sellers">
          <div className="flex items-end justify-between">
            <div>
              <p className="editorial-label text-muted-foreground">Most loved</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Best sellers</h2>
            </div>
            <Link href="/products?sort=popular" className="lux-underline hidden items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] sm:inline-flex">
              Shop all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {bestSellers.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty store hint ── */}
      {newArrivals.length === 0 && bestSellers.length === 0 && (
        <section className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h2 className="font-display text-3xl">The boutique is being dressed</h2>
          <p className="mx-auto mt-4 max-w-md text-sm font-light text-muted-foreground">
            No products have been published yet. Sign in to the webmaster dashboard to add your first
            collection.
          </p>
          <Link href="/webmaster" className="editorial-label mt-8 inline-block border-b border-foreground pb-1 hover:opacity-60">
            Open webmaster
          </Link>
        </section>
      )}
    </div>
  );
}
