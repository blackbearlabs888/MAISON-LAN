"use client";

// Dark/light theme via next-themes — class strategy (.dark on <html>).
// Colors live in globals.css (:root / .dark) so every shadcn token adapts.

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
