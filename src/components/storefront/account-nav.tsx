"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "Overview & orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile & security" },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav aria-label="Account" className="space-y-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          data-active={pathname === l.href}
          className={cn(
            "block px-3 py-2.5 text-sm font-light transition-colors",
            pathname === l.href
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          )}
        >
          {l.label}
        </Link>
      ))}
      <button
        onClick={signOut}
        className="block w-full px-3 py-2.5 text-left text-sm font-light text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        Sign out
      </button>
    </nav>
  );
}
