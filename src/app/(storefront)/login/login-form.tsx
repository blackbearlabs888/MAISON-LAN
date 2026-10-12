"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  /** Pre-validated destination from the server page (starts with "/", never "//"). */
  next?: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cookieBlocked, setCookieBlocked] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCookieBlocked(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid email or password.");
        setLoading(false);
        return;
      }

      // Round-trip check: confirm the session cookie actually stuck before
      // navigating. In embedded previews that block third-party cookies the
      // login API succeeds but the browser drops the cookie — without this
      // check the user is bounced straight back to the form with no clue why.
      let sessionStuck = true;
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        sessionStuck = Boolean((await me.json())?.user);
      } catch {
        // network hiccup on the check alone — don't punish a valid login
      }

      if (!sessionStuck) {
        setCookieBlocked(true);
        setLoading(false);
        return;
      }

      toast.success("Welcome back.");
      if (data.user.role !== "CUSTOMER") {
        router.push(next || "/webmaster");
      } else {
        router.push(next || "/account");
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="editorial-label text-muted-foreground">Welcome back</p>
        <h1 className="mt-3 font-display text-4xl">Sign in</h1>
      </div>

      {cookieBlocked && (
        <div className="mt-8 border border-border bg-secondary/50 p-4" role="alert">
          <p className="text-[13px] font-medium">Credentials accepted — but the session could not start.</p>
          <p className="mt-2 text-[13px] font-light leading-relaxed text-muted-foreground">
            This preview is blocking session cookies (third-party cookies are
            restricted while embedded). Open the store in its own browser tab —
            the <span className="font-medium">“Open in New Tab”</span> button
            above the preview — or allow third-party cookies for this site, then
            sign in again.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-10 space-y-5">
        <div>
          <Label htmlFor="login-email" className="text-[13px] font-light">Email</Label>
          <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 rounded-none" placeholder="you@example.com" autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="login-password" className="text-[13px] font-light">Password</Label>
          <Input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 rounded-none" autoComplete="current-password" />
        </div>

        {error && (
          <p className="border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-primary text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div className="flex items-center justify-between text-[13px] font-light">
          <Link href="/forgot-password" className="lux-underline text-muted-foreground">
            Forgot password?
          </Link>
          <Link href="/register" className="lux-underline">
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
}
