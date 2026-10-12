"use client";

import Link from "next/link";
import { useState } from "react";
import type { FooterSettings, SocialLink, StoreSettings } from "@/lib/store-settings";

interface FooterProps {
  settings: Pick<
    StoreSettings,
    | "storeName"
    | "footerAbout"
    | "contactEmail"
    | "contactPhone"
    | "socialLinks"
    | "newsletterEnabled"
    | "tagline"
    | "footer"
  >;
  footerPages: { title: string; slug: string }[];
}

const FALLBACK_FOOTER: FooterSettings = {
  careTitle: "Customer Care",
  shopTitle: "The House",
  contactTitle: "Contact",
  hours: "",
  bottomNote: "",
  newsletterTitle: "Join the house list",
  newsletterSubtitle: "",
  customerCare: [],
  shop: [],
};

export function SiteFooter({ settings, footerPages }: FooterProps) {
  const year = new Date().getFullYear();
  const f = { ...FALLBACK_FOOTER, ...settings.footer };
  const socialLinks = (settings.socialLinks ?? []).filter((s) => s.platform && s.url);

  return (
    <footer className="mt-auto border-t border-border bg-[#f3efe7]">
      {settings.newsletterEnabled && (
        <NewsletterInline title={f.newsletterTitle} subtitle={f.newsletterSubtitle} />
      )}

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-xl tracking-[0.14em]">{settings.storeName}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {settings.tagline}
          </p>
          <p className="mt-5 max-w-xs text-sm font-light leading-relaxed text-muted-foreground">
            {settings.footerAbout}
          </p>
          {socialLinks.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[12px] uppercase tracking-[0.16em]">
              {socialLinks.map((s, i) => (
                <li key={`${s.platform}-${i}`}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lux-underline"
                  >
                    {s.platform}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label="Customer care">
          <p className="editorial-label text-muted-foreground">{f.careTitle}</p>
          <ul className="mt-4 space-y-2.5 text-sm font-light">
            {f.customerCare
              .filter((l) => l.label && l.href)
              .map((l) => (
                <li key={`${l.label}-${l.href}`}>
                  <Link href={l.href} className="lux-underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            {footerPages.map((p) => (
              <li key={p.slug}>
                <Link href={`/pages/${p.slug}`} className="lux-underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Shop">
          <p className="editorial-label text-muted-foreground">{f.shopTitle}</p>
          <ul className="mt-4 space-y-2.5 text-sm font-light">
            {f.shop
              .filter((l) => l.label && l.href)
              .map((l) => (
                <li key={`${l.label}-${l.href}`}>
                  <Link href={l.href} className="lux-underline">
                    {l.label}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>

        <div>
          <p className="editorial-label text-muted-foreground">{f.contactTitle}</p>
          <ul className="mt-4 space-y-2.5 text-sm font-light text-muted-foreground">
            <li>
              <a href={`mailto:${settings.contactEmail}`} className="lux-underline text-foreground/80">
                {settings.contactEmail}
              </a>
            </li>
            <li>{settings.contactPhone}</li>
            {f.hours && <li className="max-w-[240px] leading-relaxed">{f.hours}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground sm:flex-row sm:px-6">
          <p>© {year} {settings.storeName}. All rights reserved.</p>
          {f.bottomNote && <p>{f.bottomNote}</p>}
        </div>
      </div>
    </footer>
  );
}

function NewsletterInline({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-border/70">
      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6">
        {title && <p className="font-display text-2xl">{title}</p>}
        {subtitle && (
          <p className="max-w-md text-sm font-light text-muted-foreground">{subtitle}</p>
        )}
        <NewsletterForm />
      </div>
    </div>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setState("done");
        setMessage("You are on the list. Welcome.");
        setEmail("");
      } else {
        setState("error");
        setMessage(data.error ?? "Something went wrong.");
      }
    } catch {
      setState("error");
      setMessage("Network error — please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md" aria-label="Newsletter subscription">
      <div className="flex items-end gap-3">
        <label htmlFor="newsletter-email-footer" className="sr-only">Email address</label>
        <input
          id="newsletter-email-footer"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          className="h-11 flex-1 border-b border-input bg-transparent px-1 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="editorial-label h-11 border-b border-foreground px-2 transition-opacity hover:opacity-60 disabled:opacity-40"
        >
          {state === "loading" ? "…" : "Subscribe"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-3 text-center text-xs ${state === "error" ? "text-destructive" : "text-[var(--brand-accent)]"}`}
          role="status"
        >
          {message}
        </p>
      )}
    </form>
  );
}
