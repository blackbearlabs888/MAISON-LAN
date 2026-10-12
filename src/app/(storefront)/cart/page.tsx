"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart, cartSubtotalCents } from "@/lib/cart-store";
import { useStoreConfig } from "@/lib/store-config";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function CartPage() {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const { settings, format } = useStoreConfig();
  const [validating, setValidating] = useState(false);

  // Server-side revalidation of prices & stock when cart is shown.
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    let cancelled = false;
    (async () => {
      setValidating(true);
      try {
        const res = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.items) {
          const { replaceItems } = useCart.getState();
          const merged = items.map((i: (typeof items)[number]) => {
            const fresh = data.items.find((x: { variantId: string }) => x.variantId === i.variantId);
            return fresh
              ? { ...i, unitPriceCents: fresh.unitPriceCents, maxStock: fresh.maxStock }
              : i;
          });
          const removed = items.filter(
            (i: (typeof items)[number]) => !data.items.some((x: { variantId: string }) => x.variantId === i.variantId)
          );
          replaceItems(merged);
          if (removed.length > 0) {
            toast.info("Some items are no longer available and were removed from your bag.");
          }
        }
      } catch {
        // silent — checkout performs authoritative validation anyway
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  const subtotal = cartSubtotalCents(items);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <Skeleton className="h-10 w-48" />
        <div className="mt-10 space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-6">
              <Skeleton className="h-36 w-28" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-9 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-28 text-center sm:px-6">
        <ShoppingBag className="h-10 w-10 text-muted-foreground/40" strokeWidth={1} />
        <h1 className="mt-6 font-display text-4xl">Your bag is empty</h1>
        <p className="mt-4 max-w-sm text-sm font-light leading-relaxed text-muted-foreground">
          Beautiful things take patience — but not this much. Discover the collection and find
          your next considered piece.
        </p>
        <Link
          href="/products"
          className="mt-10 inline-flex h-12 items-center bg-primary px-10 text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-85"
        >
          Discover the collection
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl">Shopping bag</h1>
      <p className="mt-2 text-sm font-light text-muted-foreground">
        {items.reduce((s, i) => s + i.quantity, 0)} items
        {validating && <span className="ml-3 text-[11px] uppercase tracking-[0.14em]">Checking stock…</span>}
      </p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_320px]">
        {/* items */}
        <ul className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-5 py-6 sm:gap-7">
              <Link
                href={`/products/${item.slug}`}
                className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-secondary sm:w-32"
              >
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill sizes="128px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-display text-muted-foreground">
                    {item.name}
                  </div>
                )}
              </Link>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/products/${item.slug}`} className="font-display text-lg leading-snug hover:opacity-70">
                      {item.name}
                    </Link>
                    <p className="mt-1 text-[12px] font-light text-muted-foreground">
                      {[item.color, item.size].filter(Boolean).join(" / ") || "One size"}
                      <span className="ml-2 text-muted-foreground/60">· {item.sku}</span>
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-[15px]">
                    {format(item.unitPriceCents * item.quantity)}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between pt-4">
                  <div className="flex h-9 items-center border border-border">
                    <button
                      onClick={() => {
                        const r = setQuantity(item.variantId, item.quantity - 1);
                        if (!r.ok) toast.error(r.reason);
                      }}
                      aria-label="Decrease quantity"
                      className="flex h-full w-9 items-center justify-center text-foreground/70 hover:text-foreground"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-7 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => {
                        const r = setQuantity(item.variantId, item.quantity + 1);
                        if (!r.ok) toast.error(r.reason);
                      }}
                      aria-label="Increase quantity"
                      className="flex h-full w-9 items-center justify-center text-foreground/70 hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => remove(item.variantId)}
                    className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remove ${item.name} from bag`}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* summary */}
        <aside className="h-fit border border-border bg-card p-6">
          <h2 className="font-display text-xl">Summary</h2>
          <dl className="mt-5 space-y-3 text-sm font-light">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{format(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="text-muted-foreground">Calculated at checkout</dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-[15px]">
            <span className="editorial-label">Total</span>
            <span>{format(subtotal)}</span>
          </div>
          <Link
            href="/checkout"
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-primary text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-85"
          >
            Proceed to checkout <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/products"
            className="mt-3 block py-2 text-center text-[12px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Continue shopping
          </Link>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
            Prices and stock are verified again on the server at checkout. Manual bank transfer
            instructions will be provided after ordering.
          </p>
        </aside>
      </div>
    </div>
  );
}
