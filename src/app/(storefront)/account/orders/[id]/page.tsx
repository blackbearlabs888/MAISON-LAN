import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/store-settings";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Payment verified",
  PROCESSING: "Preparing",
  READY_TO_SHIP: "Ready to ship",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const SHIPMENT_LABELS: Record<string, string> = {
  PENDING: "Preparing shipment",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Delivery exception",
  RETURNED: "Returned",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  // Ownership check: customers may only view their own orders.
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      shipment: {
        include: { statusHistory: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!order || order.userId !== user.id) notFound();

  const settings = await getStoreSettings();
  const format = (c: number) => formatMoney(c, settings.currency, settings.locale);
  const address = JSON.parse(order.shippingAddress) as {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    notes?: string;
  };

  return (
    <div>
      <Link
        href="/account"
        className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All orders
      </Link>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">{order.orderNumber}</h2>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            Placed{" "}
            {new Date(order.createdAt).toLocaleString(settings.locale, {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </div>
        <Badge variant="outline" className="rounded-none border-foreground/30 text-[11px] uppercase tracking-[0.14em]">
          {STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          {/* items */}
          <section className="border border-border">
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-[15px]">{item.name}</p>
                    <p className="mt-0.5 text-[12px] font-light text-muted-foreground">
                      {[item.color, item.size].filter(Boolean).join(" / ") || "One size"} · SKU{" "}
                      {item.sku} · ×{item.quantity}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-sm">{format(item.lineTotalCents)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-border p-4 text-sm font-light">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{format(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping — {order.shippingMethod}</dt>
                <dd>{order.shippingCostCents === 0 ? "Free" : format(order.shippingCostCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-[15px] font-normal">
                <dt>Total</dt>
                <dd>{format(order.totalCents)}</dd>
              </div>
            </dl>
          </section>

          {/* shipment */}
          <section className="border border-border p-5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Truck className="h-4 w-4" /> Shipment
            </p>
            {order.shipment?.trackingNumber ? (
              <div className="mt-4 space-y-1.5 text-sm font-light">
                <p>
                  <span className="text-muted-foreground">Courier:</span>{" "}
                  {order.shipment.courierName}
                </p>
                <p>
                  <span className="text-muted-foreground">Tracking:</span>{" "}
                  <span className="font-normal tracking-wide">{order.shipment.trackingNumber}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {SHIPMENT_LABELS[order.shipment.status] ?? order.shipment.status}
                </p>
                {order.shipment.estimatedDelivery && (
                  <p>
                    <span className="text-muted-foreground">Estimated:</span>{" "}
                    {order.shipment.estimatedDelivery}
                  </p>
                )}
                {order.shipment.trackingUrl && (
                  <a
                    href={order.shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="editorial-label inline-block mt-1 border-b border-foreground pb-0.5 hover:opacity-60"
                  >
                    Track on courier site ↗
                  </a>
                )}
                {order.shipment.statusHistory.length > 0 && (
                  <ol className="mt-4 space-y-2 border-l border-border pl-4 text-[13px]">
                    {order.shipment.statusHistory.map((h) => (
                      <li key={h.id} className="relative">
                        <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--brand-accent)]" />
                        {SHIPMENT_LABELS[h.status] ?? h.status}
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {new Date(h.createdAt).toLocaleString(settings.locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        {h.note && <p className="text-muted-foreground">{h.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm font-light text-muted-foreground">
                Tracking details appear here once your order has shipped.
              </p>
            )}
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
              Tracking updates are manual and may lag live courier data slightly.
            </p>
          </section>

          {/* history */}
          <section>
            <p className="editorial-label text-muted-foreground">Status history</p>
            <ol className="mt-4 space-y-3 border-l border-border pl-5 text-sm font-light">
              {order.statusHistory.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--brand-accent)]" />
                  <p>
                    {STATUS_LABELS[h.toStatus] ?? h.toStatus}
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {new Date(h.createdAt).toLocaleString(settings.locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </p>
                  {h.note && <p className="mt-0.5 text-[13px] text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* address sidebar */}
        <aside className="h-fit border border-border p-5 text-sm font-light">
          <p className="editorial-label text-muted-foreground">Delivery address</p>
          <div className="mt-3 space-y-0.5">
            <p className="font-normal">{address.fullName}</p>
            <p className="text-muted-foreground">{address.phone}</p>
            <p className="mt-2 text-muted-foreground">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              <br />
              {address.city}, {address.province} {address.postalCode}
              <br />
              {address.country}
            </p>
            {address.notes && (
              <p className="mt-3 border-t border-border pt-3 text-[13px] text-muted-foreground">
                “{address.notes}”
              </p>
            )}
          </div>

          <p className="editorial-label mt-6 text-muted-foreground">Payment</p>
          <p className="mt-3">
            {order.paymentStatus === "PAID_CONFIRMED" ? (
              <span className="text-[var(--brand-accent)]">Verified</span>
            ) : order.status === "CANCELLED" ? (
              "Cancelled"
            ) : (
              <>Awaiting bank transfer</>
            )}
            <span className="ml-1 text-muted-foreground">· Manual transfer</span>
          </p>
          {order.paymentStatus !== "PAID_CONFIRMED" && order.status === "PENDING_PAYMENT" && (
            <div className="mt-3 whitespace-pre-line border-t border-border pt-3 text-[12px] leading-relaxed text-muted-foreground">
              {settings.paymentInstructions}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
