"use client";

// One-time OWNER bootstrap. Reachable only while zero OWNER accounts exist;
// the API refuses once an owner exists, and this page redirects to /webmaster.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiGet, apiPost, type SetupStatusResponse } from "@/lib/webmaster-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineSpinner } from "@/components/webmaster/ui-bits";

type Phase = "checking" | "ready" | "unavailable" | "error";

export default function WebmasterSetupPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<SetupStatusResponse>("/api/webmaster/setup")
      .then((data) => {
        if (cancelled) return;
        if (data.setupRequired) {
          setPhase("ready");
        } else {
          setPhase("unavailable");
          setTimeout(() => router.replace("/webmaster"), 1200);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Could not reach the server.");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  function validate(): string | null {
    if (name.trim().length < 2) return "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      return "Password must contain letters and numbers.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await apiPost("/api/webmaster/setup", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      toast.success("Owner account created. Welcome to MAISON ÉLAN.");
      router.replace("/webmaster");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Setup failed.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <p className="editorial-label text-muted-foreground">First-run setup</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight">MAISON ÉLAN</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create the owner account to unlock the webmaster console. No default credentials ship with
            this store — this is the only chance to bootstrap.
          </p>
        </div>

        {phase === "checking" ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <InlineSpinner /> Checking setup status…
          </div>
        ) : null}

        {phase === "unavailable" ? (
          <div className="mt-10 border border-border bg-card px-6 py-8 text-center">
            <p className="font-display text-lg">An owner account already exists.</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting you to the console sign-in…</p>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="mt-10 border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
          </div>
        ) : null}

        {phase === "ready" ? (
          <form onSubmit={submit} className="mt-10 space-y-5 border border-border bg-card p-6 sm:p-8">
            <div>
              <Label htmlFor="setup-name" className="text-[13px] font-light">
                Full name
              </Label>
              <Input
                id="setup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={80}
                className="mt-1.5 h-11 rounded-none"
                placeholder="Amanda Wijaya"
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="setup-email" className="text-[13px] font-light">
                Email
              </Label>
              <Input
                id="setup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5 h-11 rounded-none"
                placeholder="owner@yourbrand.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="setup-password" className="text-[13px] font-light">
                Password
              </Label>
              <Input
                id="setup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={72}
                className="mt-1.5 h-11 rounded-none"
                placeholder="At least 8 characters, letters + numbers"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="setup-confirm" className="text-[13px] font-light">
                Confirm password
              </Label>
              <Input
                id="setup-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="mt-1.5 h-11 rounded-none"
                autoComplete="new-password"
              />
            </div>

            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? (
                <>
                  <InlineSpinner /> Creating account…
                </>
              ) : (
                "Create owner account"
              )}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
