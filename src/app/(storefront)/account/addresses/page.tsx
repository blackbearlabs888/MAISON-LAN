"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

const EMPTY = {
  label: "",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  province: "",
  postalCode: "",
  country: "Indonesia",
  isDefault: false,
};

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/addresses");
    if (res.ok) setAddresses((await res.json()).addresses);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save address.");
        return;
      }
      toast.success("Address saved.");
      setOpen(false);
      setForm({ ...EMPTY });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/addresses?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Address removed.");
      load();
    }
  }

  async function setDefault(id: string) {
    await fetch("/api/addresses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDefault: true }),
    });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Saved addresses</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="editorial-label flex items-center gap-1.5 border-b border-foreground pb-1 hover:opacity-60">
              <Plus className="h-3.5 w-3.5" /> Add address
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-none p-6 scroll-slim">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">New address</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["label", "Label (e.g. Home)", false],
                  ["fullName", "Full name *", true],
                  ["phone", "Phone *", true],
                  ["line1", "Street address *", true],
                  ["line2", "Apartment, suite", false],
                  ["city", "City *", true],
                  ["province", "Province *", true],
                  ["postalCode", "Postal code *", true],
                  ["country", "Country *", true],
                ] as const
              ).map(([key, label, required]) => (
                <div key={key} className={key === "line1" || key === "line2" ? "sm:col-span-2" : ""}>
                  <Label htmlFor={`addr-${key}`} className="text-[13px] font-light">
                    {label}
                  </Label>
                  <Input
                    id={`addr-${key}`}
                    required={required}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1.5 h-10 rounded-none"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  id="addr-default"
                  checked={form.isDefault}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v === true }))}
                />
                <Label htmlFor="addr-default" className="cursor-pointer text-[13px] font-light">
                  Set as default address
                </Label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="h-11 bg-primary text-[12px] font-medium uppercase tracking-[0.16em] text-primary-foreground hover:opacity-85 disabled:opacity-40 sm:col-span-2"
              >
                {saving ? "Saving…" : "Save address"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {addresses === null ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="mt-6 border border-dashed border-border py-16 text-center">
          <p className="font-display text-xl">No saved addresses</p>
          <p className="mx-auto mt-2 max-w-xs text-sm font-light text-muted-foreground">
            Add one for faster checkout. You can also save an address while ordering.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="border border-border p-5 text-sm font-light">
              <div className="flex items-start justify-between">
                <p className="editorial-label text-muted-foreground">{a.label ?? "Address"}</p>
                <div className="flex items-center gap-2">
                  {!a.isDefault && (
                    <button
                      onClick={() => setDefault(a.id)}
                      className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => remove(a.id)}
                    aria-label="Delete address"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {a.isDefault && (
                <span className="mt-1 inline-block bg-[var(--brand-accent)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-white">
                  Default
                </span>
              )}
              <p className="mt-3 font-normal">{a.fullName}</p>
              <p className="text-muted-foreground">{a.phone}</p>
              <p className="mt-2 text-muted-foreground">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
                <br />
                {a.city}, {a.province} {a.postalCode}
                <br />
                {a.country}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
