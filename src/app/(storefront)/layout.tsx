import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/store-settings";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { StoreConfigProvider } from "@/lib/store-config";
import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { WishlistSync } from "@/components/storefront/wishlist-button";

// Storefront reads settings + session per request — always dynamic.
export const dynamic = "force-dynamic";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();
  const user = await getCurrentUser().catch(() => null);
  const staff = user ? isStaff(user.role) : false;

  // Maintenance gate — staff can still browse and operate.
  if (settings.maintenanceEnabled && !staff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <p className="font-display text-4xl tracking-[0.14em] sm:text-5xl">{settings.storeName}</p>
        <div className="mt-6 h-px w-16 bg-[var(--brand-accent)]" />
        <p className="mt-6 max-w-md text-sm font-light leading-relaxed text-muted-foreground">
          {settings.maintenanceMessage}
        </p>
        <a
          href={`mailto:${settings.contactEmail}`}
          className="editorial-label mt-10 border-b border-foreground pb-1 hover:opacity-60"
        >
          Contact us
        </a>
      </div>
    );
  }

  let footerPages: { title: string; slug: string }[] = [];
  try {
    footerPages = await db.contentPage.findMany({
      where: { isPublished: true, showInFooter: true },
      select: { title: true, slug: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });
  } catch {
    footerPages = [];
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ "--brand-accent": settings.primaryColor } as React.CSSProperties}
    >
      <StoreConfigProvider settings={settings}>
        <WishlistSync />
        <SiteHeader
          settings={{
            storeName: settings.storeName,
            logoText: settings.logoText,
            announcementText: settings.announcementText,
            announcementEnabled: settings.announcementEnabled,
            navItems: settings.navItems,
          }}
          isStaff={staff}
          isLoggedIn={Boolean(user)}
        />
        <main className="flex-1">{children}</main>
        <SiteFooter
          settings={{
            storeName: settings.storeName,
            footerAbout: settings.footerAbout,
            contactEmail: settings.contactEmail,
            contactPhone: settings.contactPhone,
            socialLinks: settings.socialLinks,
            newsletterEnabled: settings.newsletterEnabled,
            tagline: settings.tagline,
            footer: settings.footer,
          }}
          footerPages={footerPages}
        />
      </StoreConfigProvider>
    </div>
  );
}
