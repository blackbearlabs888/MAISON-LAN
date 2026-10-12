"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-store";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

interface VariantLite {
  id: string;
  size: string | null;
  color: string | null;
  sku: string;
  stock: number;
  priceDeltaCents: number;
}

interface Props {
  variants: VariantLite[];
  basePriceCents: number;
  currency: string;
  locale: string;
  enforceStock: boolean;
  lowStockThreshold: number;
  product: { id: string; slug: string; name: string; imageUrl: string | null };
}

export function AddToCartPanel({
  variants,
  basePriceCents,
  currency,
  locale,
  enforceStock,
  lowStockThreshold,
  product,
}: Props) {
  const router = useRouter();
  const add = useCart((s) => s.add);

  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[],
    [variants]
  );
  const sizes = useMemo(
    () => Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[],
    [variants]
  );

  const [color, setColor] = useState<string | null>(colors[0] ?? null);
  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
  const [qty, setQty] = useState(1);

  const selected = variants.find(
    (v) =>
      (colors.length === 0 || v.color === color) && (sizes.length === 0 || v.size === size)
  );

  const unitPrice = basePriceCents + (selected?.priceDeltaCents ?? 0);
  const stock = selected?.stock ?? 0;
  const soldOut = enforceStock && stock <= 0;

  function addToCart() {
    if (!selected) {
      toast.error("Please select an option first.");
      return;
    }
    if (enforceStock && stock < qty) {
      toast.error(`Only ${stock} available in stock.`);
      return;
    }
    const result = add({
      variantId: selected.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      sku: selected.sku,
      size: selected.size,
      color: selected.color,
      imageUrl: product.imageUrl,
      unitPriceCents: unitPrice,
      quantity: qty,
      maxStock: enforceStock ? selected.stock : 999,
    });
    if (!result.ok) {
      toast.error(result.reason ?? "Could not add to bag.");
      return;
    }
    toast.success("Added to your bag.");
    router.push("/cart");
  }

  return (
    <div>
      {/* color selector */}
      {colors.length > 0 && (
        <div className="mt-2">
          <p className="editorial-label text-muted-foreground">
            Color {color && <span className="ml-2 text-foreground normal-case tracking-normal">{color}</span>}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  const v = variants.find((x) => x.color === c && (sizes.length === 0 || x.size === size));
                  if (!v || (enforceStock && v.stock <= 0)) {
                    const firstAvailable = variants.find((x) => x.color === c && (!enforceStock || x.stock > 0));
                    if (firstAvailable) setSize(firstAvailable.size);
                  }
                }}
                aria-pressed={color === c}
                className={cn(
                  "border px-4 py-2 text-sm font-light transition-colors",
                  color === c
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground/50"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* size selector */}
      {sizes.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="editorial-label text-muted-foreground">Size</p>
            <button className="text-[11px] uppercase tracking-[0.14em] text-muted-underline hover:opacity-60" type="button">
              Size guide
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const v = variants.find(
                (x) => x.size === s && (colors.length === 0 || x.color === color)
              );
              const available = !v || (enforceStock && v.stock <= 0) ? false : true;
              return (
                <button
                  key={s}
                  disabled={!available}
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  className={cn(
                    "min-w-12 border px-3.5 py-2 text-sm font-light transition-colors",
                    size === s
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/50",
                    !available && "cursor-not-allowed text-muted-foreground line-through opacity-50"
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* stock line */}
      <p className="mt-5 text-[12px] font-light tracking-wide">
        {!selected ? (
          <span className="text-muted-foreground">Select your options above.</span>
        ) : soldOut ? (
          <span className="text-[var(--sale)]">Out of stock</span>
        ) : enforceStock && stock <= lowStockThreshold ? (
          <span className="text-[var(--brand-accent)]">Only {stock} left — ready to ship</span>
        ) : (
          <span className="text-muted-foreground">In stock — ready to ship</span>
        )}
        {selected && (
          <span className="ml-3 text-muted-foreground/70">SKU {selected.sku}</span>
        )}
      </p>

      {/* qty + cta */}
      <div className="mt-5 flex gap-3">
        <div className="flex h-12 items-center border border-border">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="flex h-full w-11 items-center justify-center text-foreground/70 hover:text-foreground"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm" aria-live="polite">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(enforceStock ? Math.max(stock, 1) : 20, q + 1))}
            aria-label="Increase quantity"
            className="flex h-full w-11 items-center justify-center text-foreground/70 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={addToCart}
          disabled={soldOut}
          className="h-12 flex-1 bg-primary text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {soldOut ? "Sold out" : `Add to bag — ${formatMoney(unitPrice * qty, currency, locale)}`}
        </button>
        <button
          onClick={addToCart}
          disabled={soldOut}
          aria-label="Buy now"
          className="h-12 border border-foreground px-5 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          Buy
        </button>
      </div>

      <p className="mt-4 flex items-center gap-2 text-[12px] font-light text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
        Secure manual bank transfer — instructions shown at checkout.
      </p>
    </div>
  );
}
