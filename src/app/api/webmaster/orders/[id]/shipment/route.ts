import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { shipmentUpsertSchema, shipmentStatusSchema } from "@/lib/validators";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { requireStaff } from "../../../helpers";
import { notify, fmt } from "@/lib/telegram";

type Params = { params: Promise<{ id: string }> };

// PUT — create/update shipment details (courier, tracking number, estimate, note).
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("shipping");
    const { id } = await params;
    const input = shipmentUpsertSchema.parse(await req.json());

    const order = await db.order.findUnique({ where: { id }, include: { shipment: true } });
    if (!order) return fail("Order not found.", 404);

    const courier = await db.courier.findUnique({ where: { id: input.courierId } });
    if (!courier) return fail("Courier not found.", 404);

    const trackingUrl =
      input.trackingNumber && courier.trackingUrlTemplate
        ? courier.trackingUrlTemplate.replace("{trackingNumber}", encodeURIComponent(input.trackingNumber))
        : null;

    const shipment = await db.$transaction(async (tx) => {
      const s = tx.shipment.upsert({
        where: { orderId: id },
        update: {
          courierId: courier.id,
          courierName: courier.name,
          trackingNumber: input.trackingNumber || null,
          trackingUrl,
          estimatedDelivery: input.estimatedDelivery || null,
          note: input.note || null,
        },
        create: {
          orderId: id,
          courierId: courier.id,
          courierName: courier.name,
          trackingNumber: input.trackingNumber || null,
          trackingUrl,
          estimatedDelivery: input.estimatedDelivery || null,
          note: input.note || null,
          status: "PENDING",
        },
      });
      return s;
    });

    const isNewTracking = !order.shipment?.trackingNumber && input.trackingNumber;
    await audit(staff, isNewTracking ? "SHIPMENT_TRACKING_ADDED" : "SHIPMENT_UPDATE", "Shipment", shipment.id, {
      courier: courier.name,
      trackingNumber: input.trackingNumber || null,
    });

    if (isNewTracking) {
      notify(
        "SHIPMENT_ADDED",
        [
          "📦 <b>Tracking number added</b>",
          "",
          `Order: <b>${fmt(order.orderNumber)}</b>`,
          `Courier: ${fmt(courier.name)}`,
          `Tracking: ${fmt(input.trackingNumber ?? "")}`,
          `Customer: ${fmt(order.customerName)}`,
        ].join("\n"),
        id
      );
    }

    return ok({ shipment });
  } catch (err) {
    return handleError(err);
  }
}

// POST — record a shipment status change with history.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("shipping");
    const { id } = await params;
    const input = shipmentStatusSchema.parse(await req.json());

    const shipment = await db.shipment.findUnique({ where: { orderId: id } });
    if (!shipment) return fail("Create shipment details first.", 404);

    const updated = await db.$transaction(async (tx) => {
      const s = await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: input.status },
      });
      if (shipment.status !== input.status) {
        await tx.shipmentStatusHistory.create({
          data: { shipmentId: shipment.id, status: input.status, note: input.note || null },
        });
        // Order mirrors shipment progress: SHIPPED on dispatch, COMPLETED on delivery.
        const order = await tx.order.findUnique({ where: { id } });
        if (order) {
          if (input.status === "IN_TRANSIT" && ["PAID", "PROCESSING", "READY_TO_SHIP"].includes(order.status)) {
            await tx.order.update({
              where: { id },
              data: {
                status: "SHIPPED",
                statusHistory: {
                  create: {
                    fromStatus: order.status,
                    toStatus: "SHIPPED",
                    actorType: "ADMIN",
                    actorLabel: `${staff.name} (${staff.role})`,
                    note: "Shipment dispatched",
                  },
                },
              },
            });
          }
          if (input.status === "DELIVERED" && order.status === "SHIPPED") {
            await tx.order.update({
              where: { id },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
                statusHistory: {
                  create: {
                    fromStatus: "SHIPPED",
                    toStatus: "COMPLETED",
                    actorType: "ADMIN",
                    actorLabel: `${staff.name} (${staff.role})`,
                    note: "Delivery confirmed",
                  },
                },
              },
            });
          }
        }
      }
      return s;
    });

    await audit(staff, "SHIPMENT_STATUS_CHANGE", "Shipment", shipment.id, {
      from: shipment.status,
      to: input.status,
      note: input.note || null,
    });

    if (shipment.status !== input.status) {
      const order = await db.order.findUnique({ where: { id } });
      notify(
        "SHIPMENT_STATUS_CHANGED",
        [
          "🚚 <b>Shipment status updated</b>",
          "",
          `Order: <b>${fmt(order?.orderNumber ?? id)}</b>`,
          `From: ${fmt(shipment.status)} → To: <b>${fmt(input.status)}</b>`,
          input.note ? `Note: ${fmt(input.note)}` : "",
        ].join("\n"),
        id
      );
    }

    return ok({ shipment: updated });
  } catch (err) {
    return handleError(err);
  }
}
