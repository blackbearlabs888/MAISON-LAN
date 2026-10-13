"use client";

// Sun/moon toggle. Renders a stable placeholder until mounted to avoid a
// hydration mismatch (the theme is only known client-side).

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // false during SSR/hydration, true on the client — without setState-in-effect.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-foreground",
        className
      )}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-5 w-5" strokeWidth={1.5} />
        ) : (
          <Moon className="h-5 w-5" strokeWidth={1.5} />
        )
      ) : (
        <span className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
