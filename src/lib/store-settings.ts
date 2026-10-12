// White-label StoreSettings — single source of truth for brand + operation config.
// Persisted as a JSON blob in the StoreSetting singleton row; editable at runtime
// from /webmaster/settings without redeployment. Secrets NEVER live here (env only).

export interface NavItem {
  label: string;
  href: string;
}

/** A social media account shown in the storefront footer — fully dynamic list. */
export interface SocialLink {
  platform: string; // display label, e.g. "Instagram", "TikTok", "WhatsApp", "Shopee"
  url: string; // absolute https(s) URL
}

/** Footer-specific presentation settings — everything the storefront footer renders. */
export interface FooterSettings {
  careTitle: string; // column heading, e.g. "Customer Care"
  shopTitle: string; // column heading, e.g. "The House"
  contactTitle: string; // column heading, e.g. "Contact"
  hours: string; // e.g. "Mon–Fri, 9:00–18:00 WIB"
  bottomNote: string; // bottom bar right text
  newsletterTitle: string;
  newsletterSubtitle: string;
  customerCare: NavItem[]; // managed quick links (CMS pages are appended automatically)
  shop: NavItem[];
}

export interface StoreSettings {
  // Brand identity
  storeName: string;
  tagline: string;
  logoText: string; // wordmark fallback when no logo image
  logoUrl: string | null;
  primaryColor: string; // hex — accent color used across storefront
  announcementText: string;
  announcementEnabled: boolean;

  // Locale / commerce
  currency: string; // ISO 4217
  locale: string;
  timezone: string;
  orderNumberPrefix: string;

  // Contact
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  social: { instagram?: string; tiktok?: string; facebook?: string; x?: string }; // legacy — kept for pre-migration rows
  socialLinks: SocialLink[]; // managed social accounts (rendered in the footer)

  // SEO
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string | null;

  // Store operations
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  registrationEnabled: boolean;
  enforceStock: boolean;
  lowStockThreshold: number;
  paymentInstructions: string; // manual transfer instructions shown at checkout
  cancellationNote: string;
  freeShippingAboveCents: number | null;
  newsletterEnabled: boolean;

  // Homepage
  homepage: {
    heroHeadline: string;
    heroSubline: string;
    showCategories: boolean;
    showNewArrivals: boolean;
    showBestSellers: boolean;
    showEditorial: boolean;
  };

  // Navigation
  navItems: NavItem[];
  footerAbout: string;
  footer: FooterSettings;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "MAISON ÉLAN",
  tagline: "Quiet luxury, considered everyday.",
  logoText: "MAISON ÉLAN",
  logoUrl: null,
  primaryColor: "#9A7B4F",
  announcementText:
    "Complimentary shipping on orders above Rp 1.000.000 — worldwide.",
  announcementEnabled: true,

  currency: "IDR",
  locale: "id-ID",
  timezone: "Asia/Jakarta",
  orderNumberPrefix: "ME",

  contactEmail: "care@maisonelan.example",
  contactPhone: "+62 21 500 8900",
  contactAddress: "Jl. Kemang Raya No. 12, Jakarta Selatan 12730, Indonesia",
  social: {
    instagram: "https://instagram.com/maisonelan.example",
    tiktok: "https://tiktok.com/@maisonelan.example",
  },

  seoTitle: "MAISON ÉLAN — Quiet luxury, considered everyday",
  seoDescription:
    "Premium handbags, jewelry, apparel and fragrance crafted from honest materials. Editorial design, enduring quality.",
  ogImageUrl: "/images/hero-1.jpg",

  maintenanceEnabled: false,
  maintenanceMessage:
    "We are refining the boutique. Please return shortly.",
  registrationEnabled: true,
  enforceStock: true,
  lowStockThreshold: 5,
  paymentInstructions:
    "Transfer the exact total to:\n\nBank: BCATARA\nAccount: 8450 1299 007\nName: PT Maison Élan Nusantara\n\nInclude your order number as the transfer reference. Orders ship after payment is verified (usually within 1 business day).",
  cancellationNote:
    "Orders may be cancelled while status is PENDING_PAYMENT. Contact care within 2 hours of payment verification for changes.",
  freeShippingAboveCents: 100000000, // Rp 1.000.000 in minor units
  newsletterEnabled: true,

  homepage: {
    heroHeadline: "The Autumn Atelier",
    heroSubline:
      "Considered pieces in leather, silk and gold — made slowly, worn always.",
    showCategories: true,
    showNewArrivals: true,
    showBestSellers: true,
    showEditorial: true,
  },

  navItems: [
    { label: "New Arrivals", href: "/products?sort=newest" },
    { label: "Handbags", href: "/collections/handbags" },
    { label: "Jewelry", href: "/collections/jewelry" },
    { label: "Apparel", href: "/collections/apparel" },
    { label: "Accessories", href: "/collections/accessories" },
    { label: "Fragrance", href: "/collections/fragrance" },
  ],
  footerAbout:
    "MAISON ÉLAN is an independent house crafting leather goods, jewelry and apparel from honest materials. Designed in Jakarta, made responsibly.",
  footer: {
    careTitle: "Customer Care",
    shopTitle: "The House",
    contactTitle: "Contact",
    hours: "Mon–Fri, 9:00–18:00 WIB",
    bottomNote: "Manual bank transfer · Secured checkout",
    newsletterTitle: "Join the house list",
    newsletterSubtitle:
      "Early access to new collections, private previews and editorial stories. No noise.",
    customerCare: [
      { label: "Track Order", href: "/track" },
      { label: "FAQ", href: "/pages/faq" },
    ],
    shop: [
      { label: "Handbags", href: "/collections/handbags" },
      { label: "Jewelry", href: "/collections/jewelry" },
      { label: "Apparel", href: "/collections/apparel" },
      { label: "All Collections", href: "/products" },
    ],
  },
  socialLinks: [
    { platform: "Instagram", url: "https://instagram.com/maisonelan.example" },
    { platform: "TikTok", url: "https://tiktok.com/@maisonelan.example" },
  ],
};

const SETTINGS_ID = "global";

function freshList<T>(value: unknown, fallback: readonly T[]): T[] {
  return Array.isArray(value) ? (value as T[]).filter(Boolean) : fallback.map((f) => ({ ...f }));
}

/** Derive the managed social list from the legacy fixed object (pre-migration rows). */
function socialFromLegacy(s: StoreSettings["social"]): SocialLink[] {
  return [
    s.instagram ? { platform: "Instagram", url: s.instagram } : null,
    s.tiktok ? { platform: "TikTok", url: s.tiktok } : null,
    s.facebook ? { platform: "Facebook", url: s.facebook } : null,
    s.x ? { platform: "X (Twitter)", url: s.x } : null,
  ].filter((x): x is SocialLink => x !== null);
}

/** Deep-merge persisted settings over defaults so new keys never break old rows. */
function mergeSettings(persisted: Partial<StoreSettings> | null): StoreSettings {
  if (!persisted) return { ...DEFAULT_SETTINGS };
  const merged: StoreSettings = { ...DEFAULT_SETTINGS, ...persisted };
  merged.homepage = { ...DEFAULT_SETTINGS.homepage, ...(persisted.homepage ?? {}) };
  merged.social = { ...DEFAULT_SETTINGS.social, ...(persisted.social ?? {}) };
  merged.navItems = Array.isArray(persisted.navItems)
    ? persisted.navItems
    : DEFAULT_SETTINGS.navItems;
  merged.footer = {
    ...DEFAULT_SETTINGS.footer,
    ...(persisted.footer ?? {}),
    customerCare: freshList(persisted.footer?.customerCare, DEFAULT_SETTINGS.footer.customerCare),
    shop: freshList(persisted.footer?.shop, DEFAULT_SETTINGS.footer.shop),
  };
  merged.socialLinks = freshList(persisted.socialLinks, socialFromLegacy(merged.social));
  return merged;
}

/** Shape accepted by saveStoreSettings — nested objects merge over current values. */
export type StoreSettingsUpdate = Partial<Omit<StoreSettings, "homepage" | "footer" | "social">> & {
  homepage?: Partial<StoreSettings["homepage"]>;
  footer?: Partial<FooterSettings>;
  social?: Partial<StoreSettings["social"]>;
};

export async function getStoreSettings(): Promise<StoreSettings> {
  const row = await (await import("@/lib/db")).db.storeSetting.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return mergeSettings(JSON.parse(row.data));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveStoreSettings(update: StoreSettingsUpdate): Promise<StoreSettings> {
  const current = await getStoreSettings();
  // Nested sections deep-merge over CURRENT values so a partial update never resets siblings.
  const next = mergeSettings({
    ...current,
    ...update,
    social: { ...current.social, ...update.social },
    homepage: { ...current.homepage, ...update.homepage },
    footer: { ...current.footer, ...update.footer },
  });
  const data = JSON.stringify(next);
  const db = (await import("@/lib/db")).db;
  await db.storeSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { data },
    create: { id: SETTINGS_ID, data },
  });
  return next;
}
