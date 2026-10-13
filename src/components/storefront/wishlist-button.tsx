"use client";

// Wishlist UI pieces:
//  - WishlistSync  — invisible; mirrors the server wishlist into the client store
//  - WishlistHeart — toggle button used on product cards and the product page

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useWishlist } from "@/lib/wishlist-store";
import { cn } from "@/lib/utils";

export function WishlistSync() {
  const pathname = usePathname();
  const setIds = useWishlist((s) => s.setIds);
  const setAuthed = useWishlist((s) => s.setAuthed);
  const setLoaded = useWishlist((s) => s.setLoaded);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wishlist/ids", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          setAuthed(false);
          setIds([]);
        } else if (res.ok) {
          const data = await res.json();
          setAuthed(true);
          setIds(Array.isArray(data.ids) ? data.ids : []);
        }
      } catch {
        // network hiccup — keep current state
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, setIds, setAuthed, setLoaded]);

  return null;
}

export function WishlistHeart({
  productId,
  className,
  size = "card",
  productName,
}: {
  productId: string;
  className?: string;
  size?: "card" | "detail";
  productName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const ids = useWishlist((s) => s.ids);
  const authed = useWishlist((s) => s.authed);
  const add = useWishlist((s) => s.add);
  const remove = useWishlist((s) => s.remove);

  const saved = ids.includes(productId);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (authed === false) {
      toast.error("Sign in to save pieces to your wishlist.");
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    // optimistic
    if (saved) {
      remove(productId);
    } else {
      add(productId);
    }

    try {
      const res = saved
        ? await fetch(`/api/wishlist/${productId}`, { method: "DELETE" })
        : await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not update the wishlist.");
      }
      if (!saved) toast.success(productName ? `${productName} saved to wishlist.` : "Saved to wishlist.");
      if (saved) toast(productName ? `${productName} removed from wishlist.` : "Removed from wishlist.");
    } catch (err) {
      // revert on failure
      if (saved) add(productId);
      else remove(productId);
      toast.error(err instanceof Error ? err.message : "Could not update the wishlist.");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "inline-flex items-center justify-center transition-all",
        size === "card" ? "h-9 w-9" : "h-11 w-11",
        saved ? "text-[var(--sale)]" : "text-foreground/70 hover:text-foreground",
        className
      )}
    >
      <Heart
        className={cn(size === "card" ? "h-[18px] w-[18px]" : "h-5 w-5", saved && "fill-current")}
        strokeWidth={1.5}
      />
    </button>
  );
}
