import { db } from "@/lib/db";
import { requireUser, isStaff } from "@/lib/auth";
import { ok, handleError } from "@/lib/api-helpers";
import { can, type Capability } from "@/lib/permissions";
import type { NextRequest } from "next/server";

export { can };
export type { Capability };

// Staff guard for all webmaster APIs — throws AuthError handled by handleError.
export async function requireStaff(capability: Capability) {
  const user = await requireUser();
  if (!isStaff(user.role) || !can(user.role, capability)) {
    const { AuthError } = await import("@/lib/auth");
    throw new AuthError("Insufficient permissions for this operation.", 403);
  }
  return user;
}

// Helper: parse pagination query params.
export function pagination(req: NextRequest, defaultSize = 20) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? String(defaultSize)) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// Helper: record low-stock Telegram alert (dedup: only when crossing threshold).
export async function maybeNotifyLowStock(variantId: string) {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });
  if (!variant) return;
  const settings = await db.storeSetting.findUnique({ where: { id: "global" } });
  const threshold = settings ? (JSON.parse(settings.data).lowStockThreshold ?? 5) : 5;
  if (variant.stock <= threshold) {
    const { notify, fmt } = await import("@/lib/telegram");
    notify(
      "LOW_STOCK",
      `⚠️ <b>Low stock warning</b>\n\nProduct: ${fmt(variant.product.name)}\nVariant: ${fmt(variant.sku)}\nRemaining: <b>${variant.stock}</b>`,
      undefined
    );
  }
}
