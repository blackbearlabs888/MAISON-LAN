import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/store-settings";
import { formatMoney } from "@/lib/money";
import { CheckCircle2, Copy } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Order confirmed" };

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { orderNumber } = await params;
  const { email } = await searchParams;
  const settings = await getStoreSettings();
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: true, shipment: true },
  });
  if (!order) notFound();

  // Ownership gate (audit A-02): the order number alone (6 hex chars) must never
  // be enough to view contents.
  //  - Registered orders: require the signed-in owner.
  //  - Guest orders: require the matching email via ?email= (same 2-factor
  //    contract as POST /api/track).
  if (order.userId) {
    const user = await getCurrentUser();
    if (!user || user.id !== order.userId) notFound();
  } else {
    const supplied = (email ?? "").trim().toLowerCase();
    if (!supplied || supplied !== order.email.toLowerCase()) notFound();
  }

  const format = (c: number) => formatMoney(c, settings.currency, settings.locale);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--brand-accent)]" strokeWidth={1.2} />
        <p className="editorial-label mt-6 text-muted-foreground">Thank you</p>
        <h1 className="mt-3 font-display text-4xl">Your order is confirmed</h1>
        <p className="mt-4 text-sm font-light leading-relaxed text-muted-foreground">
          A confirmation has been recorded for order{" "}
          <span className="font-medium text-foreground">{order.orderNumber}</span>. Complete the
          bank transfer below — we prepare your pieces as soon as payment is verified.
        </p>
      </div>

      {/* payment instructions */}
      <section className="mt-10 border border-border bg-secondary/40 p-6" aria-label="Payment instructions">
        <div className="flex items-center justify-between">
          <p className="editorial-label">Transfer the exact amount</p>
          <p className="font-display text-xl">{format(order.totalCents)}</p>
        </div>
        <p className="mt-4 whitespace-pre-line text-[13px] font-light leading-relaxed text-muted-foreground">
          {settings.paymentInstructions}
        </p>
        <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-[12px] font-light text-muted-foreground">
          <Copy className="h-3.5 w-3.5" />
          Use order number <span className="font-medium text-foreground">{order.orderNumber}</span> as
          the transfer reference.
        </p>
      </section>

      {/* summary */}
      <section className="mt-8 border border-border" aria-label="Order summary">
        <ul className="divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 p-4 text-sm font-light">
              <div>
                <p>{item.name}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {[item.color, item.size].filter(Boolean).join(" / ")} · ×{item.quantity}
                </p>
              </div>
              <p className="whitespace-nowrap">{format(item.lineTotalCents)}</p>
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

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Link
          href={`/track?orderNumber=${order.orderNumber}&email=${encodeURIComponent(order.email)}`}
          className="inline-flex h-12 items-center bg-primary px-8 text-[12px] font-medium uppercase tracking-[0.18em] text-primary-foreground hover:opacity-85"
        >
          Track this order
        </Link>
        <Link
          href="/products"
          className="inline-flex h-12 items-center border border-foreground px-8 text-[12px] font-medium uppercase tracking-[0.18em] hover:bg-foreground hover:text-background"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
