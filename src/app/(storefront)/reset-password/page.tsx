"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed — the link may have expired.");
        setLoading(false);
        return;
      }
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="editorial-label text-muted-foreground">Account recovery</p>
        <h1 className="mt-3 font-display text-4xl">Choose a new password</h1>
      </div>
      <form onSubmit={submit} className="mt-10 space-y-5">
        <div>
          <Label htmlFor="rp-password" className="text-[13px] font-light">New password</Label>
          <Input id="rp-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 rounded-none" autoComplete="new-password" />
        </div>
        <div>
          <Label htmlFor="rp-confirm" className="text-[13px] font-light">Confirm password</Label>
          <Input id="rp-confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5 h-11 rounded-none" autoComplete="new-password" />
        </div>
        {error && (
          <p className="border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !token}
          className="h-12 w-full bg-primary text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
