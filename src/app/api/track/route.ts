import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { trackSchema } from "@/lib/validators";
import { ok, fail, handleError, clientIp } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";

// Public order tracking — requires order number + email match.
// No customer PII beyond what's needed; no enumeration possible (2-factor match).
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(`track:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
    if (!limited.ok) return fail("Too many lookups. Please wait a minute.", 429);

    const input = trackSchema.parse(await req.json());
    const order = await db.order.findUnique({
      where: { orderNumber: input.orderNumber.trim().toUpperCase() },
      include: {
        items: { select: { id: true, name: true, quantity: true, size: true, color: true } },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 10 },
        shipment: {
          include: { statusHistory: { orderBy: { createdAt: "desc" }, take: 10 } },
        },
      },
    });

    // uniform failure — same message whether the order or email is wrong
    if (!order || order.email.toLowerCase() !== input.email.toLowerCase().trim()) {
      return fail("Order not found. Check your order number and email.", 404);
    }

    return ok({
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        totalCents: order.totalCents,
        shippingMethod: order.shippingMethod,
        items: order.items,
        statusHistory: order.statusHistory,
        shipment: order.shipment
          ? {
              courierName: order.shipment.courierName,
              trackingNumber: order.shipment.trackingNumber,
              trackingUrl: order.shipment.trackingUrl,
              status: order.shipment.status,
              estimatedDelivery: order.shipment.estimatedDelivery,
              history: order.shipment.statusHistory,
            }
          : null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
