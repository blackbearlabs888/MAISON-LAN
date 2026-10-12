// Order engine — server-side truth for pricing, stock and order state.
// The browser NEVER dictates prices, totals or stock (master spec §5.D, §6).

import "server-only";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { effectiveUnitPriceCents } from "@/lib/money";
import { ORDER_TRANSITIONS } from "@/lib/validators";
import { getStoreSettings } from "@/lib/store-settings";
import type { CheckoutInput } from "@/lib/validators";
import type { StoreSettings } from "@/lib/store-settings";

// ───────────────────────── order numbers ─────────────────────────

export function generateOrderNumber(prefix: string): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
  return `${prefix}-${y}${m}-${rand}`;
}

// ───────────────────────── shipping quote ─────────────────────────

export interface ShippingQuote {
  id: string;
  courierId: string;
  courierName: string;
  courierCode: string;
  serviceName: string;
  label: string;
  rateCents: number;
  freeApplied: boolean;
  minDays: number | null;
  maxDays: number | null;
}

export async function quoteShippingRates(
  province: string,
  subtotalCents: number,
  settings?: StoreSettings
): Promise<ShippingQuote[]> {
  const s = settings ?? (await getStoreSettings());
  const rates = await db.shippingRate.findMany({
    where: { isActive: true, courier: { isActive: true } },
    include: { courier: true },
    orderBy: [{ courier: { position: "asc" } }, { rateCents: "asc" }],
  });

  const quotes: ShippingQuote[] = [];
  for (const rate of rates) {
    // region match: "*" matches all; REGION type matches normalized province name
    const regionMatch =
      rate.region === "*" ||
      (rate.type === "REGION" &&
        normalizeRegion(rate.region) === normalizeRegion(province));
    if (!regionMatch) continue;

    let rateCents = rate.rateCents;
    let freeApplied = false;
    if (s.freeShippingAboveCents != null && subtotalCents >= s.freeShippingAboveCents) {
      rateCents = 0;
      freeApplied = true;
    } else if (rate.freeAboveCents != null && subtotalCents >= rate.freeAboveCents) {
      rateCents = 0;
      freeApplied = true;
    }

    quotes.push({
      id: rate.id,
      courierId: rate.courierId,
      courierName: rate.courier.name,
      courierCode: rate.courier.code,
      serviceName: rate.name,
      label:
        rate.courier.name && rate.courier.name !== rate.name
          ? `${rate.courier.name} — ${rate.name}`
          : rate.name,
      rateCents,
      freeApplied,
      minDays: rate.courier.minDays,
      maxDays: rate.courier.maxDays,
    });
  }
  return quotes;
}

function normalizeRegion(r: string): string {
  return r.trim().toLowerCase().replace(/\s+/g, " ");
}

// ───────────────────────── checkout ─────────────────────────

export class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface CreatedOrder {
  id: string;
  orderNumber: string;
  totalCents: number;
  subtotalCents: number;
  shippingCostCents: number;
}

export async function createOrderFromCheckout(
  input: CheckoutInput,
  userId: string | null
): Promise<CreatedOrder> {
  const settings = await getStoreSettings();

  // Idempotency: same key → return the existing order (no duplicates from retries).
  const existing = await db.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: {
      id: true,
      orderNumber: true,
      totalCents: true,
      subtotalCents: true,
      shippingCostCents: true,
    },
  });
  if (existing) return existing;

  // Load variants with products — all pricing/stock from DB only.
  const variantIds = input.items.map((i) => i.variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  let subtotalCents = 0;
  const lines = input.items.map((item) => {
    const variant = variantMap.get(item.variantId);
    if (!variant || variant.product.archivedAt || !variant.product.isActive) {
      throw new CheckoutError("One of the items is no longer available.", 409);
    }
    if (settings.enforceStock && variant.stock < item.quantity) {
      throw new CheckoutError(
        `Only ${variant.stock} left of ${variant.product.name}` +
          (variant.size || variant.color ? ` (${[variant.color, variant.size].filter(Boolean).join(" / ")})` : "") +
          ". Please adjust your cart.",
        409
      );
    }
    const unit = effectiveUnitPriceCents(variant.product) + variant.priceDeltaCents;
    const lineTotal = unit * item.quantity;
    subtotalCents += lineTotal;
    return { variant, item, unit, lineTotal };
  });

  // Shipping rate from DB (never client-supplied).
  const quotes = await quoteShippingRates(input.shippingAddress.province, subtotalCents, settings);
  const chosen = quotes.find((q) => q.id === input.shippingRateId);
  if (!chosen) {
    throw new CheckoutError(
      "The selected shipping method is unavailable for this order. Please choose another.",
      400
    );
  }
  const shippingCostCents = chosen.rateCents;
  const totalCents = subtotalCents + shippingCostCents;

  // Transactional creation + stock deduction (prevents overselling under concurrency).
  const order = await db.$transaction(async (tx) => {
    // Re-check stock inside the transaction for enforceStock mode.
    if (settings.enforceStock) {
      for (const { variant, item } of lines) {
        const fresh = await tx.productVariant.findUnique({ where: { id: variant.id } });
        if (!fresh || fresh.stock < item.quantity) {
          throw new CheckoutError(
            `Stock for "${variant.product.name}" changed while checking out. Please review your cart.`,
            409
          );
        }
      }
      for (const { variant, item } of lines) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(settings.orderNumberPrefix),
        idempotencyKey: input.idempotencyKey,
        userId,
        email: input.email.toLowerCase(),
        phone: input.phone,
        customerName: input.customerName,
        shippingAddress: JSON.stringify({
          fullName: input.customerName,
          phone: input.phone,
          line1: input.shippingAddress.line1,
          line2: input.shippingAddress.line2 || "",
          city: input.shippingAddress.city,
          province: input.shippingAddress.province,
          postalCode: input.shippingAddress.postalCode,
          country: input.shippingAddress.country,
          notes: input.shippingAddress.notes || "",
        }),
        shippingMethod: chosen.label,
        shippingCostCents,
        subtotalCents,
        totalCents,
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
        customerNote: input.shippingAddress.notes || null,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: "PENDING_PAYMENT",
            actorType: "CUSTOMER",
            actorLabel: userId ? input.customerName : "Guest",
            note: "Order created",
          },
        },
        items: {
          create: lines.map(({ variant, item, unit, lineTotal }) => ({
            productId: variant.productId,
            variantId: variant.id,
            name: variant.product.name,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            imageUrl: variant.product.images[0]?.url ?? null,
            unitPriceCents: unit,
            quantity: item.quantity,
            lineTotalCents: lineTotal,
          })),
        },
      },
      select: {
        id: true,
        orderNumber: true,
        totalCents: true,
        subtotalCents: true,
        shippingCostCents: true,
      },
    });

    return created;
  });

  if (input.saveAddress && userId) {
    await db.address
      .create({
        data: {
          userId,
          label: "Checkout",
          fullName: input.customerName,
          phone: input.phone,
          line1: input.shippingAddress.line1,
          line2: input.shippingAddress.line2 || "",
          city: input.shippingAddress.city,
          province: input.shippingAddress.province,
          postalCode: input.shippingAddress.postalCode,
          country: input.shippingAddress.country,
        },
      })
      .catch(() => undefined);
  }

  return order;
}

// ───────────────────────── status transitions ─────────────────────────

export class TransitionError extends Error {
  status = 409;
}

export function assertTransition(from: string, to: string): void {
  if (from === to) return; // no-op writes are tolerated but produce no history row
  const allowed = ORDER_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new TransitionError(`Cannot change order status from ${from} to ${to}.`);
  }
}

// ───────────────────────── low stock notifier ─────────────────────────

export function checkLowStock(variantStocks: { stock: number; sku: string }[], threshold: number) {
  return variantStocks.filter((v) => v.stock <= threshold);
}
