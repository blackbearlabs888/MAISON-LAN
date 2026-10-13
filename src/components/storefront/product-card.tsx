import Link from "next/link";
import Image from "next/image";
import { formatMoney, effectiveUnitPriceCents } from "@/lib/money";
import { WishlistHeart } from "@/components/storefront/wishlist-button";

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  salePriceCents: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  isNewArrival: boolean;
  isBestSeller: boolean;
  totalStock: number;
  categoryName?: string | null;
}

interface Props {
  product: ProductCardData;
  currency: string;
  locale: string;
  priority?: boolean;
  lowStockThreshold?: number;
}

export function ProductCard({ product, currency, locale, priority, lowStockThreshold = 5 }: Props) {
  const price = effectiveUnitPriceCents(product);
  const onSale = product.salePriceCents != null && product.salePriceCents < product.priceCents;
  const soldOut = product.totalStock <= 0;
  const lowStock = !soldOut && product.totalStock <= lowStockThreshold;

  return (
    <article className="group relative">
      <WishlistHeart
        productId={product.id}
        className="absolute right-2 top-2 z-10 bg-background/80 backdrop-blur-sm transition-opacity group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        productName={product.name}
      />
      <Link href={`/products/${product.slug}`} className="block" aria-label={product.name}>
        <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-muted-foreground">
              {product.name}
            </div>
          )}

          {/* badges */}
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {soldOut && (
              <span className="bg-foreground/85 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-background">
                Sold out
              </span>
            )}
            {onSale && !soldOut && (
              <span className="bg-[var(--sale)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                Sale
              </span>
            )}
            {product.isNewArrival && !soldOut && !onSale && (
              <span className="bg-background/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]">
                New
              </span>
            )}
            {product.isBestSeller && !soldOut && (
              <span className="bg-background/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]">
                Best seller
              </span>
            )}
          </div>

          {lowStock && (
            <span className="absolute bottom-3 left-3 bg-background/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/80">
              Only {product.totalStock} left
            </span>
          )}
        </div>

        <div className="pt-3.5">
          {product.categoryName && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {product.categoryName}
            </p>
          )}
          <h3 className="mt-1 font-display text-lg leading-snug">{product.name}</h3>
          <p className="mt-1 text-sm font-light">
            {onSale ? (
              <>
                <span className="mr-2 text-[var(--sale)]">{formatMoney(price, currency, locale)}</span>
                <span className="text-muted-foreground line-through">
                  {formatMoney(product.priceCents, currency, locale)}
                </span>
              </>
            ) : (
              formatMoney(price, currency, locale)
            )}
          </p>
        </div>
      </Link>
    </article>
  );
}
