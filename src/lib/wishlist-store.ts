"use client";

// Wishlist client state — the SERVER is the source of truth (DB rows).
// The store only mirrors the synced id list so hearts everywhere render
// consistently without prop-drilling. Never persisted to localStorage.

import { create } from "zustand";

interface WishlistState {
  ids: string[];
  /** null = unknown (sync still running) · true/false = sign-in state as seen by the API */
  authed: boolean | null;
  loaded: boolean;
  setIds: (ids: string[]) => void;
  setAuthed: (authed: boolean) => void;
  setLoaded: (loaded: boolean) => void;
  add: (productId: string) => void;
  remove: (productId: string) => void;
}

export const useWishlist = create<WishlistState>()((set) => ({
  ids: [],
  authed: null,
  loaded: false,
  setIds: (ids) => set({ ids }),
  setAuthed: (authed) => set({ authed }),
  setLoaded: (loaded) => set({ loaded }),
  add: (productId) =>
    set((s) => (s.ids.includes(productId) ? s : { ids: [...s.ids, productId] })),
  remove: (productId) => set((s) => ({ ids: s.ids.filter((id) => id !== productId) })),
}));
