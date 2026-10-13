"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, ShoppingBag, User, Menu, X, Heart, LayoutDashboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useCart, cartCount } from "@/lib/cart-store";
import { useWishlist } from "@/lib/wishlist-store";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NavItem, StoreSettings } from "@/lib/store-settings";

interface HeaderProps {
  settings: Pick<
    StoreSettings,
    | "storeName"
    | "logoText"
    | "announcementText"
    | "announcementEnabled"
    | "navItems"
  >;
  isStaff: boolean;
  isLoggedIn: boolean;
}

export function SiteHeader({ settings, isStaff, isLoggedIn }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const wishlistCount = useWishlist((s) => s.ids.length);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const count = hydrated ? cartCount(items) : 0;

  // Reset transient menus when the route changes (adjust state during render —
  // the React-recommended pattern instead of a setState-in-effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (mobileOpen) setMobileOpen(false);
    if (searchOpen) setSearchOpen(false);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/products?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
    }
  }

  const nav: NavItem[] = settings.navItems;

  return (
    <header className="sticky top-0 z-40">
      {settings.announcementEnabled && settings.announcementText && (
        <div className="bg-primary text-primary-foreground">
          <p className="mx-auto max-w-7xl px-4 py-2 text-center text-[11px] font-light uppercase tracking-[0.14em]">
            {settings.announcementText}
          </p>
        </div>
      )}

      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* left — desktop nav / mobile burger */}
          <nav className="hidden flex-1 items-center gap-7 lg:flex" aria-label="Primary">
            {nav.slice(0, 5).map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="lux-underline text-[12px] font-normal uppercase tracking-[0.16em] text-foreground/80 transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label="Open menu"
                  className="inline-flex h-10 w-10 items-center justify-center text-foreground"
                >
                  <Menu className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 border-border p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="flex h-full flex-col">
                  <div className="border-b border-border px-6 py-5 font-display text-xl tracking-[0.08em]">
                    {settings.logoText}
                  </div>
                  <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
                    {nav.map((item) => (
                      <Link
                        key={"m" + item.href + item.label}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="px-3 py-3 text-sm uppercase tracking-[0.14em] text-foreground/80 hover:bg-secondary hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="my-3 h-px bg-border" />
                    <Link href="/track" onClick={() => setMobileOpen(false)} className="px-3 py-3 text-sm uppercase tracking-[0.14em] text-foreground/80 hover:bg-secondary">
                      Track Order
                    </Link>
                    <Link href={isLoggedIn ? "/account/wishlist" : "/login?next=%2Faccount%2Fwishlist"} onClick={() => setMobileOpen(false)} className="px-3 py-3 text-sm uppercase tracking-[0.14em] text-foreground/80 hover:bg-secondary">
                      Wishlist
                    </Link>
                    <Link href={isLoggedIn ? "/account" : "/login"} onClick={() => setMobileOpen(false)} className="px-3 py-3 text-sm uppercase tracking-[0.14em] text-foreground/80 hover:bg-secondary">
                      {isLoggedIn ? "My Account" : "Sign In"}
                    </Link>
                    {isStaff && (
                      <Link href="/webmaster" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-3 text-sm uppercase tracking-[0.14em] text-primary hover:bg-secondary">
                        <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                        Dashboard
                      </Link>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-border px-3 pt-3">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Theme</span>
                      <ThemeToggle />
                    </div>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* center — wordmark */}
          <Link
            href="/"
            className="flex flex-1 justify-center font-display text-[22px] font-medium tracking-[0.18em] sm:text-2xl"
            aria-label={`${settings.storeName} — home`}
          >
            {settings.logoText}
          </Link>

          {/* right — dashboard / theme / search / account / wishlist / bag */}
          <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
            {isStaff && (
              <Link
                href="/webmaster"
                aria-label="Back to webmaster dashboard"
                className="mr-1 hidden h-9 items-center gap-2 border border-foreground/20 px-3 text-[11px] font-normal uppercase tracking-[0.16em] text-foreground/80 transition-colors hover:border-foreground/60 hover:text-foreground md:inline-flex"
              >
                <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Dashboard
              </Link>
            )}
            <ThemeToggle className="hidden sm:inline-flex" />
            <button
              aria-label="Search products"
              onClick={() => setSearchOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-foreground"
            >
              {searchOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Search className="h-5 w-5" strokeWidth={1.5} />}
            </button>
            <Link
              href={isLoggedIn ? "/account" : "/login"}
              aria-label={isLoggedIn ? "My account" : "Sign in"}
              className="hidden h-10 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-foreground sm:inline-flex"
            >
              <User className="h-5 w-5" strokeWidth={1.5} />
            </Link>
            <Link
              href={isLoggedIn ? "/account/wishlist" : "/login?next=%2Faccount%2Fwishlist"}
              aria-label={`Wishlist, ${wishlistCount} items`}
              className="relative inline-flex h-10 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-foreground"
            >
              <Heart className="h-5 w-5" strokeWidth={1.5} />
              {wishlistCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-accent)] px-1 text-[10px] font-medium text-white">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link
              href="/cart"
              aria-label={`Shopping bag, ${count} items`}
              className="relative inline-flex h-10 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-foreground"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-accent)] px-1 text-[10px] font-medium text-white">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-border bg-background">
            <form onSubmit={submitSearch} className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for handbags, jewelry, silk…"
                className="border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                aria-label="Search"
              />
              <button type="submit" className="editorial-label text-foreground/70 hover:text-foreground">
                Search
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
