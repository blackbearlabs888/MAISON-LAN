"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, Truck, ChevronDown } from "lucide-react";
import { useCart, cartSubtotalCents, type CartItem } from "@/lib/cart-store";
import { useStoreConfig } from "@/lib/store-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ShippingQuote {
  id: string;
  label: string;
  rateCents: number;
  freeApplied: boolean;
  minDays: number | null;
  maxDays: number | null;
}

interface SavedAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  label: string | null;
  isDefault?: boolean;
}

// RFC-4122 v4 UUID from crypto.getRandomValues — used only when
// crypto.randomUUID() is unavailable (older browsers / non-secure contexts).
function generateUuidFallback(): string {
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
  buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const clear = useCart((s) => s.clear);
  const { settings, format } = useStoreConfig();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Indonesia");
  const [notes, setNotes] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);

  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedRate, setSelectedRate] = useState<string>("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cartSubtotalCents(items);
  const shipping = quotes.find((q) => q.id === selectedRate)?.rateCents ?? null;
  const total = subtotal + (shipping ?? 0);

  const isLoggedIn = useMemo(() => Boolean(name), [name]);

  // Pre-fill for logged-in customers
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (data.user) {
          setEmail((e) => e || data.user.email);
          setName((n) => n || data.user.name);
          setPhone((p) => p || data.user.phone || "");
          const aRes = await fetch("/api/addresses");
          if (aRes.ok) {
            const aData = await aRes.json();
            const list: SavedAddress[] = aData.addresses ?? [];
            setSavedAddresses(list);
            const def = list.find((a) => a.isDefault) ?? list[0];
            if (def) applyAddress(def);
          }
        }
      } catch {
        // guest checkout continues
      }
    })();
  }, [hydrated]);

  function applyAddress(a: SavedAddress) {
    setName(a.fullName);
    setPhone(a.phone);
    setLine1(a.line1);
    setLine2(a.line2 ?? "");
    setCity(a.city);
    setProvince(a.province);
    setPostalCode(a.postalCode);
    setCountry(a.country || "Indonesia");
  }

  // Fetch shipping quotes whenever province changes
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    if (province.trim().length < 3) {
      setQuotes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setQuoteLoading(true);
      try {
        const res = await fetch("/api/shipping/methods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ province, subtotalCents: subtotal }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setQuotes(data.quotes ?? []);
          setSelectedRate((cur) => {
            if (cur && data.quotes?.some((q: ShippingQuote) => q.id === cur)) return cur;
            // prefer cheapest
            const cheapest = (data.quotes ?? []).reduce(
              (min: ShippingQuote | null, q: ShippingQuote) =>
                !min || q.rateCents < min.rateCents ? q : min,
              null as ShippingQuote | null
            );
            return cheapest?.id ?? "";
          });
        } else {
          setQuotes([]);
          setSelectedRate("");
        }
      } catch {
        if (!cancelled) {
          setQuotes([]);
          setSelectedRate("");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [province, hydrated, items.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError("Your bag is empty.");
      return;
    }
    if (!selectedRate) {
      setError("Please select a shipping method for your delivery area.");
      return;
    }

    setSubmitting(true);
    // Valid UUIDv4 with a randomValues fallback for browsers without randomUUID
    // (checkoutSchema requires UUID format — a Date/Math fallback would 422).
    const idempotencyKey =
      globalThis.crypto?.randomUUID?.() ?? generateUuidFallback();

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          email,
          phone,
          customerName: name,
          shippingAddress: { line1, line2, city, province, postalCode, country, notes },
          shippingRateId: selectedRate,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          saveAddress: isLoggedIn && saveAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout failed — please review your details.");
        setSubmitting(false);
        return;
      }
      clear();
      router.push(
        `/checkout/success/${data.orderNumber}?email=${encodeURIComponent(email)}`
      );
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Skeleton className="h-10 w-56" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28 text-center sm:px-6">
        <h1 className="font-display text-4xl">Nothing to check out</h1>
        <p className="mt-4 text-sm font-light text-muted-foreground">
          Your bag is empty. Add a piece first, then return here.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-flex h-12 items-center bg-primary px-10 text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground hover:opacity-85"
        >
          Browse the collection
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl">Checkout</h1>
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Secure
        </p>
      </div>

      <form onSubmit={submit} className="mt-10 grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          {/* contact */}
          <section>
            <h2 className="editorial-label text-muted-foreground">01 — Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <Label htmlFor="co-email" className="text-[13px] font-light">Email *</Label>
                <Input id="co-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 rounded-none" placeholder="you@example.com" />
              </div>
              <div>
                <Label htmlFor="co-name" className="text-[13px] font-light">Full name *</Label>
                <Input id="co-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11 rounded-none" placeholder="Ayu Kartika" />
              </div>
              <div>
                <Label htmlFor="co-phone" className="text-[13px] font-light">Phone (WhatsApp) *</Label>
                <Input id="co-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 h-11 rounded-none" placeholder="+62 812 000 000" />
              </div>
            </div>
          </section>

          {/* address */}
          <section>
            <h2 className="editorial-label text-muted-foreground">02 — Shipping address</h2>

            {savedAddresses.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {savedAddresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => applyAddress(a)}
                    className={cn(
                      "border px-3 py-2 text-left text-[12px] font-light transition-colors hover:border-foreground/60",
                      line1 === a.line1 && city === a.city
                        ? "border-foreground bg-secondary"
                        : "border-border"
                    )}
                  >
                    <span className="uppercase tracking-[0.1em]">{a.label ?? "Address"}</span>
                    <span className="ml-2 text-muted-foreground">{a.city}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="co-line1" className="text-[13px] font-light">Street address *</Label>
                <Input id="co-line1" required value={line1} onChange={(e) => setLine1(e.target.value)} className="mt-1.5 h-11 rounded-none" placeholder="House / street" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="co-line2" className="text-[13px] font-light">Apartment, suite, etc.</Label>
                <Input id="co-line2" value={line2} onChange={(e) => setLine2(e.target.value)} className="mt-1.5 h-11 rounded-none" />
              </div>
              <div>
                <Label htmlFor="co-city" className="text-[13px] font-light">City *</Label>
                <Input id="co-city" required value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5 h-11 rounded-none" />
              </div>
              <div>
                <Label htmlFor="co-province" className="text-[13px] font-light">Province *</Label>
                <Input id="co-province" required value={province} onChange={(e) => setProvince(e.target.value)} className="mt-1.5 h-11 rounded-none" placeholder="e.g. Jakarta Selatan" />
              </div>
              <div>
                <Label htmlFor="co-postal" className="text-[13px] font-light">Postal code *</Label>
                <Input id="co-postal" required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="mt-1.5 h-11 rounded-none" />
              </div>
              <div>
                <Label htmlFor="co-country" className="text-[13px] font-light">Country *</Label>
                <Input id="co-country" required value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1.5 h-11 rounded-none" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="co-notes" className="text-[13px] font-light">Delivery notes</Label>
                <Textarea id="co-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5 min-h-20 rounded-none" placeholder="Landmarks, safe drop instructions…" />
              </div>
              {isLoggedIn && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox id="co-save" checked={saveAddress} onCheckedChange={(v) => setSaveAddress(v === true)} />
                  <Label htmlFor="co-save" className="text-[13px] font-light cursor-pointer">
                    Save this address to my account
                  </Label>
                </div>
              )}
            </div>
          </section>

          {/* shipping method */}
          <section>
            <h2 className="editorial-label text-muted-foreground">03 — Shipping method</h2>
            {quoteLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : quotes.length === 0 ? (
              <p className="mt-4 border border-dashed border-border p-4 text-sm font-light text-muted-foreground">
                Enter your province above to see available shipping methods and rates.
              </p>
            ) : (
              <RadioGroup value={selectedRate} onValueChange={setSelectedRate} className="mt-4 space-y-2">
                {quotes.map((q) => (
                  <div
                    key={q.id}
                    className={cn(
                      "flex items-center justify-between border p-4 transition-colors",
                      selectedRate === q.id ? "border-foreground bg-secondary/60" : "border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value={q.id} id={`ship-${q.id}`} className="mt-0.5" />
                      <Label htmlFor={`ship-${q.id}`} className="cursor-pointer">
                        <span className="block text-sm">{q.label}</span>
                        <span className="mt-0.5 block text-[12px] font-light text-muted-foreground">
                          {q.minDays && q.maxDays
                            ? `Estimated ${q.minDays}–${q.maxDays} business days`
                            : "Tracked delivery"}
                        </span>
                      </Label>
                    </div>
                    <span className="text-sm">
                      {q.rateCents === 0 ? (
                        <span className="text-[var(--brand-accent)]">Free</span>
                      ) : (
                        format(q.rateCents)
                      )}
                    </span>
                  </div>
                ))}
              </RadioGroup>
            )}
            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground/80">
              <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Tracking updates are managed manually by our team and are not synchronized live with
              the courier.
            </p>
          </section>

          {/* payment */}
          <section>
            <h2 className="editorial-label text-muted-foreground">04 — Payment</h2>
            <div className="mt-4 border border-border bg-secondary/40 p-5">
              <p className="text-sm font-medium uppercase tracking-[0.12em]">Manual bank transfer</p>
              <p className="mt-3 whitespace-pre-line text-[13px] font-light leading-relaxed text-muted-foreground">
                {settings.paymentInstructions}
              </p>
              <p className="mt-4 text-[12px] font-light text-muted-foreground">
                After checkout you will receive your order number and these instructions again.
                Your order is prepared once payment is verified.
              </p>
            </div>
            {settings.cancellationNote && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
                Cancellation: {settings.cancellationNote}
              </p>
            )}
          </section>
        </div>

        {/* summary */}
        <aside className="h-fit border border-border bg-card p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-xl">Your order</h2>
          <ul className="mt-5 max-h-72 space-y-4 overflow-y-auto pr-1 scroll-slim">
            {items.map((item: CartItem) => (
              <li key={item.variantId} className="flex gap-3">
                <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-secondary">
                  {item.imageUrl && (
                    <Image src={item.imageUrl} alt={item.name} fill sizes="56px" className="object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col text-[13px]">
                  <p className="font-light leading-snug">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {[item.color, item.size].filter(Boolean).join(" / ")} · ×{item.quantity}
                  </p>
                  <p className="mt-auto">{format(item.unitPriceCents * item.quantity)}</p>
                </div>
              </li>
            ))}
          </ul>

          <dl className="mt-6 space-y-2.5 border-t border-border pt-4 text-sm font-light">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{format(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd>{shipping == null ? "—" : shipping === 0 ? "Free" : format(shipping)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-[15px]">
            <span className="editorial-label">Total</span>
            <span>{format(total)}</span>
          </div>

          {error && (
            <p className="mt-4 border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedRate}
            className="mt-6 flex h-12 w-full items-center justify-center bg-primary text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Placing order…" : "Place order"}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
            <ChevronDown className="h-3 w-3" />
            No payment is charged online — transfer manually after ordering.
          </p>
        </aside>
      </form>
    </div>
  );
}
