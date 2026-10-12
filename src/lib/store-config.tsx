"use client";

// Client-side access to white-label store settings (currency, locale, brand values).
// Provided once from the (storefront) server layout; never contains secrets.

import { createContext, useContext, type ReactNode } from "react";
import type { StoreSettings } from "@/lib/store-settings";

const StoreConfigContext = createContext<StoreSettings | null>(null);

export function StoreConfigProvider({
  settings,
  children,
}: {
  settings: StoreSettings;
  children: ReactNode;
}) {
  return <StoreConfigContext.Provider value={settings}>{children}</StoreConfigContext.Provider>;
}

export function useStoreConfig(): { settings: StoreSettings; format: (cents: number) => string } {
  const settings = useContext(StoreConfigContext);
  if (!settings) {
    // Fallback for edge cases (e.g. webmaster preview surfaces)
    return {
      settings: {
        currency: "IDR",
        locale: "id-ID",
      } as StoreSettings,
      format: (cents) =>
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(cents / 100),
    };
  }
  const format = (cents: number) => {
    try {
      return new Intl.NumberFormat(settings.locale, {
        style: "currency",
        currency: settings.currency,
        minimumFractionDigits: settings.currency === "IDR" ? 0 : 2,
        maximumFractionDigits: settings.currency === "IDR" ? 0 : 2,
      }).format(cents / 100);
    } catch {
      return `${settings.currency} ${(cents / 100).toFixed(2)}`;
    }
  };
  return { settings, format };
}
