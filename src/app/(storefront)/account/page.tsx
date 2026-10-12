import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, ChevronRight } from "lucide-react";
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

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const settings = await getStoreSettings();
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { items: { take: 3 }, shipment: { select: { trackingNumber: true, status: true } } },
  });

  return (
    <div className="space-y-12">
      <section aria-label="Order history">
        <h2 className="font-display text-2xl">Order history</h2>

        {orders.length === 0 ? (
          <div className="mt-6 flex flex-col items-center border border-dashed border-border py-16 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.2} />
            <p className="mt-4 font-display text-xl">No orders yet</p>
            <p className="mt-2 max-w-xs text-sm font-light text-muted-foreground">
              When you place an order it will appear here with status and tracking.
            </p>
            <Link
              href="/products"
              className="editorial-label mt-6 border-b border-foreground pb-1 hover:opacity-60"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="group flex flex-wrap items-center justify-between gap-3 py-5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-display text-lg">{order.orderNumber}</p>
                    <p className="mt-0.5 text-[13px] font-light text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString(settings.locale, {
                        dateStyle: "medium",
                      })}{" "}
                      · {order.items.length}{" "}
                      {order.items.length === 1 ? "item" : "items"}
                      {order.shipment?.trackingNumber && (
                        <span className="ml-2 text-[var(--brand-accent)]">
                          · Tracked {order.shipment.trackingNumber}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant="outline"
                      className="rounded-none border-foreground/25 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                    <span className="text-[15px]">
                      {formatMoney(order.totalCents, settings.currency, settings.locale)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
