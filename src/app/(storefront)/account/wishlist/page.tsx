import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/store-settings";
import { WishlistView } from "@/components/storefront/wishlist-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const settings = await getStoreSettings();
  return (
    <div>
      <div className="border-b border-border pb-6">
        <p className="editorial-label text-muted-foreground">Saved pieces</p>
        <h2 className="mt-2 font-display text-3xl">Wishlist</h2>
      </div>
      <div className="mt-8">
        <WishlistView currency={settings.currency} locale={settings.locale} />
      </div>
    </div>
  );
}
