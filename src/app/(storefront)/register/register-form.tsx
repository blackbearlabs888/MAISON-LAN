"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setLoading(false);
        return;
      }

      // Same round-trip check as the login form — embedded previews that block
      // third-party cookies would otherwise bounce straight back to /login.
      let sessionStuck = true;
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        sessionStuck = Boolean((await me.json())?.user);
      } catch {
        // check-only failure — don't punish a valid registration
      }

      if (!sessionStuck) {
        setCookieBlocked(true);
        setLoading(false);
        return;
      }

      toast.success("Welcome to the house.");
      router.push("/account");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="editorial-label text-muted-foreground">Join the house</p>
        <h1 className="mt-3 font-display text-4xl">Create account</h1>
        <p className="mt-3 text-sm font-light text-muted-foreground">
          Faster checkout, saved addresses and your order history — always yours.
        </p>
      </div>

      {cookieBlocked && (
        <div className="mt-8 border border-border bg-secondary/50 p-4" role="alert">
          <p className="text-[13px] font-medium">Account created — but the session could not start.</p>
          <p className="mt-2 text-[13px] font-light leading-relaxed text-muted-foreground">
            This preview is blocking session cookies (third-party cookies are
            restricted while embedded). Open the store in its own browser tab —
            the <span className="font-medium">“Open in New Tab”</span> button
            above the preview — or allow third-party cookies for this site, then
            sign in with your new account.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-10 space-y-5">
        <div>
          <Label htmlFor="reg-name" className="text-[13px] font-light">Full name</Label>
          <Input id="reg-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11 rounded-none" autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="reg-email" className="text-[13px] font-light">Email</Label>
          <Input id="reg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 rounded-none" autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="reg-phone" className="text-[13px] font-light">Phone (optional)</Label>
          <Input id="reg-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 h-11 rounded-none" autoComplete="tel" />
        </div>
        <div>
          <Label htmlFor="reg-password" className="text-[13px] font-light">Password</Label>
          <Input id="reg-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 rounded-none" autoComplete="new-password" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">At least 8 characters, with letters and numbers.</p>
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
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-[13px] font-light">
          Already a member?{" "}
          <Link href="/login" className="lux-underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
