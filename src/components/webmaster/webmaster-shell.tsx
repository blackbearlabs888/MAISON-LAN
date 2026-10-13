"use client";

// Dashboard chrome: capability-filtered sidebar (desktop) + Sheet drawer (mobile),
// staff identity block and sign-out. Nav visibility mirrors server-side
// permissions — the API re-checks every capability on each request anyway.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  Users,
} from "lucide-react";
import { can, type Capability } from "@/lib/permissions";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { apiPost } from "@/lib/webmaster-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

interface NavItemDef {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  capability: Capability | null; // null → visible to all staff
  exact?: boolean;
}

const NAV: NavItemDef[] = [
  { href: "/webmaster", label: "Dashboard", icon: LayoutDashboard, capability: null, exact: true },
  { href: "/webmaster/orders", label: "Orders", icon: ShoppingBag, capability: "orders" },
  { href: "/webmaster/products", label: "Products", icon: Package, capability: "products" },
  { href: "/webmaster/categories", label: "Categories", icon: Tag, capability: "categories" },
  { href: "/webmaster/customers", label: "Customers", icon: Users, capability: "customers" },
  { href: "/webmaster/shipping", label: "Shipping", icon: Truck, capability: "shipping" },
  { href: "/webmaster/banners", label: "Banners", icon: ImageIcon, capability: "banners" },
  { href: "/webmaster/pages", label: "CMS Pages", icon: FileText, capability: "pages" },
  { href: "/webmaster/faq", label: "FAQ", icon: HelpCircle, capability: "faq" },
  { href: "/webmaster/notifications", label: "Notifications", icon: Bell, capability: "notifications" },
  { href: "/webmaster/settings", label: "Store settings", icon: Settings, capability: "settings" },
  { href: "/webmaster/audit", label: "Audit log", icon: ScrollText, capability: "audit" },
];

export interface ShellUser {
  name: string;
  email: string;
  role: Role;
}

function RoleLabel({ role }: { role: Role }) {
  const tone =
    role === "OWNER"
      ? "text-[#7d6134]"
      : role === "ADMIN"
        ? "text-foreground"
        : "text-muted-foreground";
  return (
    <span className={cn("editorial-label text-[10px]", tone)}>
      {role.replace("_", " ")}
    </span>
  );
}

function NavList({
  role,
  pathname,
  onNavigate,
}: {
  role: Role;
  pathname: string;
  onNavigate?: () => void;
}) {
  const items = NAV.filter((item) => item.capability === null || can(role, item.capability));
  return (
    <nav aria-label="Webmaster" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
              active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-[#9a7b4f]" : "text-muted-foreground")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandBlock({ withToggle = false }: { withToggle?: boolean }) {
  return (
    <div className="flex items-start justify-between border-b border-border px-4 py-5">
      <Link href="/webmaster" className="block">
        <p className="font-display text-xl leading-none tracking-wide">MAISON ÉLAN</p>
        <p className="editorial-label mt-1.5 text-[10px] text-muted-foreground">Webmaster Console</p>
      </Link>
      {withToggle && <ThemeToggle className="-mr-1 -mt-1" />}
    </div>
  );
}

function StaffBlock({ user }: { user: ShellUser }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await apiPost("/api/auth/logout");
      toast.success("Signed out.");
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed.");
      setSigningOut(false);
    }
  }

  return (
    <div className="mt-auto border-t border-border px-4 py-4">
      <p className="truncate text-sm font-medium">{user.name}</p>
      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      <div className="mt-0.5">
        <RoleLabel role={user.role} />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full justify-start rounded-none"
        asChild
      >
        <Link href="/">
          <Store className="h-4 w-4" aria-hidden />
          View store
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="mt-2 w-full justify-start rounded-none"
        onClick={signOut}
        disabled={signingOut}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out
      </Button>
    </div>
  );
}

export function WebmasterShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <BrandBlock withToggle />
        <div className="scroll-slim flex-1 overflow-y-auto py-3">
          <NavList role={user.role} pathname={pathname} />
        </div>
        <StaffBlock user={user} />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-none" aria-label="Open navigation menu">
              <Menu className="h-4 w-4" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col gap-0 rounded-none p-0">
            <SheetHeader className="border-b border-border p-0">
              <SheetTitle asChild>
                <div className="px-4 py-5 text-left">
                  <p className="font-display text-xl leading-none tracking-wide">MAISON ÉLAN</p>
                  <p className="editorial-label mt-1.5 text-[10px] text-muted-foreground">Webmaster Console</p>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="scroll-slim flex-1 overflow-y-auto py-3">
              <NavList role={user.role} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
            <StaffBlock user={user} />
          </SheetContent>
        </Sheet>
        <Link href="/webmaster" className="font-display text-lg tracking-wide">
          MAISON ÉLAN
          <span className="editorial-label ml-2 text-[10px] text-muted-foreground">Console</span>
        </Link>
        <ThemeToggle className="ml-auto" />
      </div>

      {/* Content */}
      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:ml-64 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
