import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sans = Jost({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export async function generateMetadata(): Promise<Metadata> {
  // White-label metadata comes from StoreSettings (DB) with safe fallbacks.
  const { getStoreSettings } = await import("@/lib/store-settings");
  let s = {
    storeName: "MAISON ÉLAN",
    seoTitle: "MAISON ÉLAN — Quiet luxury, considered everyday",
    seoDescription: "Premium handbags, jewelry, apparel and fragrance.",
  };
  try {
    const settings = await getStoreSettings();
    s = {
      storeName: settings.storeName,
      seoTitle: settings.seoTitle,
      seoDescription: settings.seoDescription,
    };
  } catch {
    // DB not ready (e.g. before first migration) — fall back to defaults
  }
  return {
    title: { default: s.seoTitle, template: `%s — ${s.storeName}` },
    description: s.seoDescription,
    icons: { icon: "/favicon.svg" },
    openGraph: {
      title: s.seoTitle,
      description: s.seoDescription,
      siteName: s.storeName,
      type: "website",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${sans.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <Sonner position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
