"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setName(data.user.name);
          setPhone(data.user.phone ?? "");
          setEmail(data.user.email);
        }
      }
    })();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Profile updated.");
      else toast.error(data.error ?? "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPw(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password changed.");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        toast.error(data.error ?? "Could not change password.");
      }
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <div className="max-w-xl space-y-12">
      <section>
        <h2 className="font-display text-2xl">Profile</h2>
        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="pf-email" className="text-[13px] font-light">Email</Label>
            <Input id="pf-email" value={email} disabled className="mt-1.5 h-11 rounded-none bg-secondary/50" />
            <p className="mt-1 text-[11px] text-muted-foreground">Email cannot be changed.</p>
          </div>
          <div>
            <Label htmlFor="pf-name" className="text-[13px] font-light">Full name</Label>
            <Input id="pf-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11 rounded-none" />
          </div>
          <div>
            <Label htmlFor="pf-phone" className="text-[13px] font-light">Phone</Label>
            <Input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 h-11 rounded-none" />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-11 bg-primary px-8 text-[12px] font-medium uppercase tracking-[0.16em] text-primary-foreground hover:opacity-85 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display text-2xl">Security</h2>
        <form onSubmit={changePassword} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="pw-current" className="text-[13px] font-light">Current password</Label>
            <Input id="pw-current" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1.5 h-11 rounded-none" autoComplete="current-password" />
          </div>
          <div>
            <Label htmlFor="pw-new" className="text-[13px] font-light">New password</Label>
            <Input id="pw-new" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5 h-11 rounded-none" autoComplete="new-password" />
            <p className="mt-1 text-[11px] text-muted-foreground">At least 8 characters, with letters and numbers.</p>
          </div>
          <button
            type="submit"
            disabled={changingPw}
            className="h-11 border border-foreground px-8 text-[12px] font-medium uppercase tracking-[0.16em] hover:bg-foreground hover:text-background disabled:opacity-40"
          >
            {changingPw ? "Updating…" : "Change password"}
          </button>
        </form>
      </section>
    </div>
  );
}
