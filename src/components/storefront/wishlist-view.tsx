"use client";

// Wishlist page view — mirrors the server wishlist (DB) via /api/wishlist.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, effectiveUnitPriceCents } from "@/lib/money";
import { useWishlist } from "@/lib/wishlist-store";
import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/webmaster/ui-bits";

interface WishlistEntry {
  id: string;
  productId: string;
  addedAt: string;
  name: string;
  slug: string;
  priceCents: number;
  salePriceCents: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  totalStock: number;
  categoryName: string | null;
}

type Phase = "loading" | "ready" | "error";

export function WishlistView({ currency, locale }: { currency: string; locale: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const ids = useWishlist((s) => s.ids);
  const syncRemove = useWishlist((s) => s.remove);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/wishlist", { cache: "no-store" });
      if (res.status === 401) throw new Error("Please sign in to view your wishlist.");
      if (!res.ok) throw new Error("Could not load the wishlist.");
      const data = await res.json();
      setItems(data.items ?? []);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the wishlist.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeItem(productId: string, name: string) {
    setRemovingId(productId);
    try {
      const res = await fetch(`/api/wishlist/${productId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove the piece.");
      setItems((list) => list.filter((i) => i.productId !== productId));
      syncRemove(productId); // keep header badge in sync
      toast(`${name} removed from wishlist.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the piece.");
    } finally {
      setRemovingId(null);
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <InlineSpinner /> Loading wishlist…
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-4 rounded-none" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <Heart className="mx-auto h-8 w-8 text-muted-foreground/50" strokeWidth={1.25} aria-hidden />
        <p className="mt-4 font-display text-2xl">Your wishlist is empty</p>
        <p className="mt-2 text-sm font-light text-muted-foreground">
          Tap the heart on any piece to keep it here for later.
        </p>
        <Button asChild className="mt-6 rounded-none">
          <Link href="/products">Browse the collections</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="editorial-label text-muted-foreground">
        {items.length} saved {items.length === 1 ? "piece" : "pieces"}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
        {items.map((item) => {
          const price = effectiveUnitPriceCents(item);
          const onSale = item.salePriceCents != null && item.salePriceCents < item.priceCents;
          const soldOut = item.totalStock <= 0;
          return (
            <article key={item.id} className="group relative">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${item.name} from wishlist`}
                disabled={removingId === item.productId}
                onClick={() => void removeItem(item.productId, item.name)}
                className="absolute right-1 top-1 z-10 h-9 w-9 rounded-none bg-background/80 text-muted-foreground backdrop-blur-sm hover:bg-background hover:text-[var(--sale)]"
              >
                {removingId === item.productId ? (
                  <InlineSpinner />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
              </Button>
              <Link href={`/products/${item.slug}`} className="block" aria-label={item.name}>
                <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.imageAlt ?? item.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-display text-muted-foreground">
                      {item.name}
                    </div>
                  )}
                  {soldOut && (
                    <span className="absolute left-3 top-3 bg-foreground/85 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-background">
                      Sold out
                    </span>
                  )}
                </div>
                <div className="pt-3.5">
                  {item.categoryName && (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {item.categoryName}
                    </p>
                  )}
                  <h3 className="mt-1 font-display text-lg leading-snug">{item.name}</h3>
                  <p className="mt-1 text-sm font-light">
                    {onSale ? (
                      <>
                        <span className="mr-2 text-[var(--sale)]">{formatMoney(price, currency, locale)}</span>
                        <span className="text-muted-foreground line-through">
                          {formatMoney(item.priceCents, currency, locale)}
                        </span>
                      </>
                    ) : (
                      formatMoney(price, currency, locale)
                    )}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {soldOut ? "Notify me" : "Select options"}
                  </p>
                </div>
              </Link>
            </article>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {ids.length} items in wishlist
      </p>
    </div>
  );
}
