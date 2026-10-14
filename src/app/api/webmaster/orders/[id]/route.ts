import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import {
  orderStatusUpdateSchema,
  paymentConfirmSchema,
  orderNoteSchema,
} from "@/lib/validators";
import { assertTransition } from "@/lib/orders";
import { getStoreSettings } from "@/lib/store-settings";
import { ok, fail, handleError, appUrl } from "@/lib/api-helpers";
import { requireStaff } from "../../helpers";
import { notify, fmt } from "@/lib/telegram";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireStaff("orders");
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
        paymentRecords: { orderBy: { confirmedAt: "desc" } },
        shipment: { include: { statusHistory: { orderBy: { createdAt: "desc" } } } },
      },
    });
    if (!order) return fail("Order not found.", 404);

    const user = order.userId
      ? await db.user.findUnique({
          where: { id: order.userId },
          select: { id: true, email: true, name: true, phone: true, createdAt: true },
        })
      : null;

    return ok({ order, customer: user });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH — three sub-actions: status change, payment confirmation, admin note.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaff("orders");
    const { id } = await params;
    const body = await req.json();
    const action = String(body.action ?? "");

    const order = await db.order.findUnique({ where: { id } });
    if (!order) return fail("Order not found.", 404);

    // ── status transition ──
    if (action === "status") {
      const input = orderStatusUpdateSchema.parse(body);
      assertTransition(order.status, input.status);

      const now = new Date();
      const data: Record<string, unknown> = { status: input.status };
      if (input.status === "PAID") {
        data.paidAt = now;
        data.paymentStatus = "PAID_CONFIRMED";
      }
      if (input.status === "CANCELLED") data.cancelledAt = now;
      if (input.status === "COMPLETED") data.completedAt = now;
      if (input.status === "REFUNDED") data.paymentStatus = "REFUNDED";

      // Restock INSIDE the transaction, only when stock enforcement is on —
      // enforcement being on at checkout is what reserved the stock in the
      // first place (audit A-03: previous version restocked unconditionally,
      // outside the tx, inflating stock in enforceStock-off stores and
      // drifting on mid-loop failures).
      const settings = await getStoreSettings();

      const updated = await db.$transaction(async (tx) => {
        if (input.status === "CANCELLED" && settings.enforceStock) {
          const items = await tx.orderItem.findMany({
            where: { orderId: id, variantId: { not: null } },
            select: { variantId: true, quantity: true },
          });
          for (const item of items) {
            if (!item.variantId) continue;
            // updateMany never throws on a deleted variant — no partial-failure drift
            await tx.productVariant.updateMany({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
        const o = await tx.order.update({
          where: { id },
          data: {
            ...(data as {
              status: string;
              paidAt?: Date;
              paymentStatus?: string;
              cancelledAt?: Date;
              completedAt?: Date;
            }),
          },
        });
        if (order.status !== input.status) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: id,
              fromStatus: order.status,
              toStatus: input.status,
              actorType: "ADMIN",
              actorLabel: `${staff.name} (${staff.role})`,
              note: input.note || null,
            },
          });
        }
        return o;
      });

      await audit(staff, "ORDER_STATUS_CHANGE", "Order", id, {
        from: order.status,
        to: input.status,
        note: input.note || null,
      });

      if (input.status === "PAID") {
        notify(
          "PAYMENT_CONFIRMED",
          [
            "💳 <b>Payment confirmed</b>",
            "",
            `Order: <b>${fmt(order.orderNumber)}</b>`,
            `Customer: ${fmt(order.customerName)}`,
            `Total: ${fmt(order.totalCents / 100)} ${fmt(settingsCurrency())}`,
            "",
            `Manage: ${fmt(appUrl())}/webmaster/orders`,
          ].join("\n"),
          id
        );
      }
      if (input.status === "CANCELLED") {
        notify("ORDER_CANCELLED", [
          "❌ <b>Order cancelled</b>",
          "",
          `Order: <b>${fmt(order.orderNumber)}</b>`,
          `By: ${fmt(staff.name)}`,
          input.note ? `Note: ${fmt(input.note)}` : "",
        ].join("\n"), id);
      }

      return ok({ order: updated });
    }

    // ── manual payment confirmation ──
    if (action === "confirm-payment") {
      const input = paymentConfirmSchema.parse(body);
      if (order.paymentStatus === "PAID_CONFIRMED") {
        return fail("Payment was already confirmed for this order.", 409);
      }
      const updated = await db.$transaction(async (tx) => {
        await tx.paymentRecord.create({
          data: {
            orderId: id,
            amountCents: order.totalCents,
            reference: input.reference || null,
            note: input.note || null,
            confirmedById: staff.id,
          },
        });
        const o = await tx.order.update({
          where: { id },
          data: {
            paymentStatus: "PAID_CONFIRMED",
            paidAt: new Date(),
            // payment verified implies moving PENDING_PAYMENT → PAID
            ...(order.status === "PENDING_PAYMENT"
              ? {
                  status: "PAID",
                  statusHistory: {
                    create: {
                      fromStatus: "PENDING_PAYMENT",
                      toStatus: "PAID",
                      actorType: "ADMIN",
                      actorLabel: `${staff.name} (${staff.role})`,
                      note: "Payment confirmed manually",
                    },
                  },
                }
              : {}),
          },
        });
        return o;
      });

      await audit(staff, "ORDER_PAYMENT_CONFIRM", "Order", id, {
        reference: input.reference || null,
        amountCents: order.totalCents,
      });
      notify("PAYMENT_CONFIRMED", [
        "💳 <b>Payment confirmed</b>",
        "",
        `Order: <b>${fmt(order.orderNumber)}</b>`,
        `Customer: ${fmt(order.customerName)}`,
        `Amount: ${fmt(order.totalCents / 100)}`,
        input.reference ? `Reference: ${fmt(input.reference)}` : "",
      ].join("\n"), id);

      return ok({ order: updated });
    }

    // ── admin note ──
    if (action === "note") {
      const input = orderNoteSchema.parse(body);
      await db.order.update({ where: { id }, data: { adminNote: input.adminNote } });
      await audit(staff, "ORDER_NOTE", "Order", id);
      return ok({ success: true });
    }

    return fail("Unknown action.", 400);
  } catch (err) {
    return handleError(err);
  }
}

function settingsCurrency(): string {
  // cheap sync default; fine for notification text
  return "IDR";
}
