import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validators";
import { createOrderFromCheckout, CheckoutError } from "@/lib/orders";
import { getStoreSettings } from "@/lib/store-settings";
import { ok, fail, handleError, clientIp } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { notify, fmt } from "@/lib/telegram";

// POST /api/orders — create an order from checkout (idempotent, server-priced).
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(`checkout:${clientIp(req)}`, { limit: 10, windowMs: 60_000 });
    if (!limited.ok) return fail("Too many checkout attempts. Please wait a minute.", 429);

    const user = await getCurrentUser();
    const input = checkoutSchema.parse(await req.json());

    const settings = await getStoreSettings();
    const order = await createOrderFromCheckout(input, user?.id ?? null);

    // Notification AFTER the transaction committed — never inside it.
    const itemCount = input.items.reduce((s, i) => s + i.quantity, 0);
    notify(
      "ORDER_CREATED",
      [
        "🛍 <b>New order received</b>",
        "",
        `Order: <b>${fmt(order.orderNumber)}</b>`,
        `Placed: ${fmt(new Date().toISOString().replace("T", " ").slice(0, 16))} UTC`,
        `Customer: ${fmt(input.customerName)}`,
        `Total: <b>${fmt((order.totalCents / 100).toLocaleString(settings.locale, { style: "currency", currency: settings.currency, maximumFractionDigits: 0 }))}</b>`,
        `Payment: PENDING_PAYMENT`,
        `Status: PENDING_PAYMENT`,
        `Shipping: ${fmt("selected at checkout")}`,
        `Items: ${itemCount}`,
        "",
        `Manage: ${fmt(process.env.APP_URL || "http://localhost:3000")}/webmaster/orders`,
      ].join("\n"),
      order.id
    );

    return ok(
      {
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
        subtotalCents: order.subtotalCents,
        shippingCostCents: order.shippingCostCents,
      },
      201
    );
  } catch (err) {
    return handleError(err);
  }
}

// GET /api/orders — current user's orders.
export async function GET() {
  try {
    const user = await requireUser();
    const orders = await db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: { take: 3 }, shipment: { select: { trackingNumber: true } } },
    });
    return ok({ orders });
  } catch (err) {
    return handleError(err);
  }
}
