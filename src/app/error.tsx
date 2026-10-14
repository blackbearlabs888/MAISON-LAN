"use client";

import { useEffect } from "react";

// Branded route-level error boundary (audit A-06). Renders inside the root
// layout; global-error.tsx covers failures in the root layout itself.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the server/browser logs only — never to the UI.
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-background px-4 text-center">
      <p className="editorial-label text-muted-foreground">Something went wrong</p>
      <h1 className="mt-3 font-display text-4xl">An unexpected error occurred</h1>
      <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-muted-foreground">
        Please try again. If the problem persists, contact our concierge.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex h-12 items-center bg-primary px-8 text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground hover:opacity-85"
      >
        Try again
      </button>
    </main>
  );
}
