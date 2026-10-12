"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { useStoreConfig } from "@/lib/store-config";

interface TrackResult {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  totalCents: number;
  shippingMethod: string;
  items: { id: string; name: string; quantity: number; size: string | null; color: string | null }[];
  statusHistory: { id: string; toStatus: string; note: string | null; createdAt: string }[];
  shipment: {
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: string;
    estimatedDelivery: string | null;
    history: { id: string; status: string; note: string | null; createdAt: string }[];
  } | null;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Payment verified",
  PROCESSING: "Preparing",
  READY_TO_SHIP: "Ready to ship",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Preparing shipment",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Delivery exception",
  RETURNED: "Returned to sender",
};

export default function TrackPage() {
  const searchParams = useSearchParams();
  const { settings } = useStoreConfig();
  const [orderNumber, setOrderNumber] = useState(searchParams.get("orderNumber") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: orderNumber.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Order not found. Check your order number and email.");
      } else {
        setResult(data.order);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <PackageSearch className="mx-auto h-10 w-10 text-muted-foreground/50" strokeWidth={1.2} />
        <h1 className="mt-5 font-display text-4xl">Track your order</h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-light leading-relaxed text-muted-foreground">
          Enter your order number and the email used at checkout. Tracking updates are managed
          manually by our team.
        </p>
      </div>

      <form onSubmit={submit} className="mx-auto mt-10 max-w-md space-y-4">
        <div>
          <Label htmlFor="track-number" className="text-[13px] font-light">Order number</Label>
          <Input
            id="track-number"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="ME-2512-XXXXXX"
            className="mt-1.5 h-11 rounded-none tracking-wide"
          />
        </div>
        <div>
          <Label htmlFor="track-email" className="text-[13px] font-light">Email</Label>
          <Input
            id="track-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 h-11 rounded-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-primary text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {loading ? "Searching…" : "Track order"}
        </button>
        {error && (
          <p className="border border-destructive/30 bg-destructive/10 p-3 text-center text-[13px] text-destructive" role="alert">
            {error}
          </p>
        )}
      </form>

      {loading && (
        <div className="mx-auto mt-10 max-w-md space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {result && (
        <section className="fade-up mt-12 border border-border" aria-live="polite">
          {/* header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <p className="editorial-label text-muted-foreground">Order</p>
              <p className="mt-1 font-display text-2xl">{result.orderNumber}</p>
            </div>
            <div className="text-right">
              <Badge
                variant="outline"
                className="rounded-none border-foreground/30 text-[11px] uppercase tracking-[0.14em]"
              >
                {ORDER_STATUS_LABELS[result.status] ?? result.status}
              </Badge>
              <p className="mt-1.5 text-sm">
                {formatMoney(result.totalCents, settings.currency, settings.locale)}
              </p>
            </div>
          </div>

          {/* shipment */}
          <div className="border-b border-border p-5">
            <p className="editorial-label text-muted-foreground">Shipment</p>
            {result.shipment && result.shipment.trackingNumber ? (
              <div className="mt-3 space-y-1.5 text-sm font-light">
                <p>
                  <span className="text-muted-foreground">Courier:</span> {result.shipment.courierName}
                </p>
                <p>
                  <span className="text-muted-foreground">Tracking number:</span>{" "}
                  <span className="font-normal tracking-wide">{result.shipment.trackingNumber}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {SHIPMENT_STATUS_LABELS[result.shipment.status] ?? result.shipment.status}
                </p>
                {result.shipment.estimatedDelivery && (
                  <p>
                    <span className="text-muted-foreground">Estimated delivery:</span>{" "}
                    {result.shipment.estimatedDelivery}
                  </p>
                )}
                {result.shipment.trackingUrl && (
                  <a
                    href={result.shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="editorial-label inline-block mt-1 border-b border-foreground pb-0.5 hover:opacity-60"
                  >
                    Track on courier site ↗
                  </a>
                )}
                {result.shipment.history.length > 0 && (
                  <ol className="mt-4 space-y-2 border-l border-border pl-4 text-[13px]">
                    {result.shipment.history.map((h) => (
                      <li key={h.id} className="relative">
                        <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--brand-accent)]" />
                        <p>
                          {SHIPMENT_STATUS_LABELS[h.status] ?? h.status}
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            {new Date(h.createdAt).toLocaleString(settings.locale, { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        </p>
                        {h.note && <p className="text-muted-foreground">{h.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm font-light text-muted-foreground">
                No shipment has been dispatched yet. Tracking details appear here once your order
                ships.
              </p>
            )}
          </div>

          {/* items + history */}
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="border-b border-border p-5 sm:border-b-0 sm:border-r">
              <p className="editorial-label text-muted-foreground">Items</p>
              <ul className="mt-3 space-y-1.5 text-sm font-light">
                {result.items.map((i) => (
                  <li key={i.id}>
                    {i.name} <span className="text-muted-foreground">×{i.quantity}</span>
                    {(i.size || i.color) && (
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({[i.color, i.size].filter(Boolean).join(" / ")})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-5">
              <p className="editorial-label text-muted-foreground">Order history</p>
              <ol className="mt-3 space-y-2 text-[13px] font-light">
                {result.statusHistory.map((h) => (
                  <li key={h.id}>
                    {ORDER_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {new Date(h.createdAt).toLocaleString(settings.locale, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    {h.note && <p className="text-muted-foreground">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
