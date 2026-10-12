"use client";

import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setSent(true);
      // No SMTP configured in this release: when the server returns a dev-only
      // token we surface it directly (never in production mode).
      if (data.devResetToken) setDevToken(data.devResetToken);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="editorial-label text-muted-foreground">Account recovery</p>
        <h1 className="mt-3 font-display text-4xl">Reset password</h1>
      </div>

      {sent ? (
        <div className="mt-10 border border-border bg-secondary/40 p-6 text-center">
          <p className="text-sm font-light leading-relaxed text-muted-foreground">
            If an account exists for <span className="text-foreground">{email}</span>, a reset link
            has been generated. This release delivers the link by direct arrangement — contact
            customer care to complete the reset.
          </p>
          {devToken && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--brand-accent)]">
                Development mode
              </p>
              <Link
                href={`/reset-password?token=${devToken}`}
                className="mt-2 inline-block break-all text-[12px] underline"
              >
                Open reset link
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10 space-y-5">
          <div>
            <Label htmlFor="fp-email" className="text-[13px] font-light">Email</Label>
            <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 rounded-none" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full bg-primary text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {loading ? "Sending…" : "Request reset"}
          </button>
          <p className="text-center text-[13px] font-light">
            <Link href="/login" className="lux-underline text-muted-foreground">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
