import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/store-settings";
import { formatMoney } from "@/lib/money";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { AddToCartPanel } from "@/components/storefront/add-to-cart-panel";
import { ChevronRight, Truck, ShieldCheck, RotateCcw } from "lucide-react";

export const dynamic = "force-dynamic";

async function getProduct(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
      categories: { include: { category: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug).catch(() => null);
  if (!product) return { title: "Product" };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || !product.isActive || product.archivedAt) notFound();

  const settings = await getStoreSettings();
  const currency = settings.currency;
  const locale = settings.locale;
  const onSale = product.salePriceCents != null && product.salePriceCents < product.priceCents;
  const price = onSale ? product.salePriceCents! : product.priceCents;

  const relatedRaw = await db.product.findMany({
    where: {
      isActive: true,
      archivedAt: null,
      id: { not: product.id },
      categories: product.categories.length
        ? { some: { categoryId: product.categories[0].categoryId } }
        : undefined,
    },
    take: 4,
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      categories: { include: { category: true } },
      variants: { select: { stock: true } },
    },
  });
  const related: ProductCardData[] = relatedRaw.map((p) => ({
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.skuBase,
    brand: { "@type": "Brand", name: settings.storeName },
    offers: {
      "@type": "Offer",
      price: (price / 100).toFixed(2),
      priceCurrency: currency,
      availability:
        product.variants.some((v) => v.stock > 0)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="fade-up">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* breadcrumb */}
      <nav className="mx-auto max-w-7xl px-4 pt-6 sm:px-6" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[12px] font-light text-muted-foreground">
          <li><Link href="/" className="hover:text-foreground">Home</Link></li>
          <li aria-hidden><ChevronRight className="h-3 w-3" /></li>
          <li><Link href="/products" className="hover:text-foreground">Shop</Link></li>
          {product.categories[0] && (
            <>
              <li aria-hidden><ChevronRight className="h-3 w-3" /></li>
              <li>
                <Link href={`/collections/${product.categories[0].category.slug}`} className="hover:text-foreground">
                  {product.categories[0].category.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden><ChevronRight className="h-3 w-3" /></li>
          <li aria-current="page" className="text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <ProductGallery
          images={product.images.map((i) => ({ url: i.url, alt: i.alt ?? product.name }))}
          name={product.name}
        />

        <div className="lg:py-6">
          {product.categories[0] && (
            <p className="editorial-label text-muted-foreground">
              {product.categories[0].category.name}
            </p>
          )}
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{product.name}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            <p className={`text-xl ${onSale ? "text-[var(--sale)]" : ""}`}>
              {formatMoney(price, currency, locale)}
            </p>
            {onSale && (
              <p className="text-base text-muted-foreground line-through">
                {formatMoney(product.priceCents, currency, locale)}
              </p>
            )}
          </div>

          <p className="mt-6 text-[15px] font-light leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          <div className="mt-8">
            <AddToCartPanel
              variants={product.variants.map((v) => ({
                id: v.id,
                size: v.size,
                color: v.color,
                sku: v.sku,
                stock: v.stock,
                priceDeltaCents: v.priceDeltaCents,
              }))}
              basePriceCents={price}
              currency={currency}
              locale={locale}
              enforceStock={settings.enforceStock}
              lowStockThreshold={settings.lowStockThreshold}
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                imageUrl: product.images[0]?.url ?? null,
              }}
            />
          </div>

          {/* assurance */}
          <div className="mt-10 space-y-3 border-t border-border pt-6 text-sm font-light text-muted-foreground">
            <p className="flex items-center gap-3">
              <Truck className="h-4 w-4 text-foreground/60" />
              Tracked shipping, dispatched after payment verification.
            </p>
            <p className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-foreground/60" />
              Hand-inspected before leaving the atelier.
            </p>
            <p className="flex items-center gap-3">
              <RotateCcw className="h-4 w-4 text-foreground/60" />
              7-day returns on unworn pieces — see the return policy.
            </p>
          </div>

          {/* details */}
          {(product.material || product.details) && (
            <div className="mt-8 border-t border-border pt-6">
              {product.material && (
                <p className="text-sm font-light">
                  <span className="editorial-label mr-3 text-muted-foreground">Material</span>
                  {product.material}
                </p>
              )}
              {product.details && (
                <details className="group mt-4">
                  <summary className="editorial-label cursor-pointer list-none hover:opacity-60">
                    Details & care
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-sm font-light leading-relaxed text-muted-foreground">
                    {product.details}
                  </p>
                </details>
              )}
              <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Reference: {product.skuBase}
              </p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6" aria-label="Related products">
          <h2 className="font-display text-3xl">You may also like</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
