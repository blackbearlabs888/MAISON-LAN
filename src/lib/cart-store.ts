"use client";

// Client-side cart (Zustand + localStorage persistence).
// NOTE: cart prices are display-only conveniences — the server recomputes all
// totals from the database at checkout (see lib/orders.ts / api/checkout).

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  size: string | null;
  color: string | null;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  maxStock: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  hydrated: boolean;
  add: (item: CartItem) => { ok: boolean; reason?: string };
  remove: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => { ok: boolean; reason?: string };
  clear: () => void;
  setOpen: (open: boolean) => void;
  markHydrated: () => void;
  replaceItems: (items: CartItem[]) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      hydrated: false,

      add: (item) => {
        const items = get().items;
        const existing = items.find((i) => i.variantId === item.variantId);
        const totalQty = (existing?.quantity ?? 0) + item.quantity;
        if (item.maxStock > 0 && totalQty > item.maxStock) {
          return { ok: false, reason: `Only ${item.maxStock} available in stock.` };
        }
        if (totalQty > 20) {
          return { ok: false, reason: "Maximum 20 units per item." };
        }
        if (existing) {
          set({
            items: items.map((i) =>
              i.variantId === item.variantId ? { ...i, quantity: totalQty, unitPriceCents: item.unitPriceCents } : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
        return { ok: true };
      },

      remove: (variantId) =>
        set({ items: get().items.filter((i) => i.variantId !== variantId) }),

      setQuantity: (variantId, quantity) => {
        const items = get().items;
        const target = items.find((i) => i.variantId === variantId);
        if (!target) return { ok: false, reason: "Item not found." };
        if (quantity <= 0) {
          set({ items: items.filter((i) => i.variantId !== variantId) });
          return { ok: true };
        }
        if (quantity > 20) return { ok: false, reason: "Maximum 20 units per item." };
        if (target.maxStock > 0 && quantity > target.maxStock) {
          return { ok: false, reason: `Only ${target.maxStock} available in stock.` };
        }
        set({
          items: items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
        });
        return { ok: true };
      },

      clear: () => set({ items: [] }),
      setOpen: (open) => set({ isOpen: open }),
      markHydrated: () => set({ hydrated: true }),
      replaceItems: (items) => set({ items }),
    }),
    {
      name: "me-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);

export function cartSubtotalCents(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
