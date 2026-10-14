import Link from "next/link";

// Branded 404 — replaces the framework default screen (audit A-06).
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-background px-4 text-center">
      <p className="editorial-label text-muted-foreground">404</p>
      <h1 className="mt-3 font-display text-4xl">This page could not be found</h1>
      <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-muted-foreground">
        The piece you are looking for may have been moved or is no longer available.
      </p>
      <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-12 items-center bg-primary px-8 text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground hover:opacity-85"
        >
          Return home
        </Link>
        <Link
          href="/products"
          className="inline-flex h-12 items-center border border-foreground px-8 text-[12px] font-medium uppercase tracking-[0.18em] hover:bg-foreground hover:text-background"
        >
          Browse collection
        </Link>
      </div>
    </main>
  );
}
