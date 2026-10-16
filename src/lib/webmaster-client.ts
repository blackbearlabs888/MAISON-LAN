// Typed fetch helpers for the webmaster dashboard.
// All backend endpoints already exist — this file only wraps them with
// strict types, uniform error handling and a few client-side utilities.

// ───────────────────────── core request wrappers ─────────────────────────

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Network error — please check your connection and try again.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty body is acceptable for some responses
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status}).`;
    throw new Error(msg);
  }
  return data as T;
}

export const apiGet = <T>(url: string): Promise<T> => request<T>("GET", url);
export const apiPost = <T>(url: string, body?: unknown): Promise<T> => request<T>("POST", url, body ?? {});
export const apiPut = <T>(url: string, body?: unknown): Promise<T> => request<T>("PUT", url, body ?? {});
export const apiPatch = <T>(url: string, body?: unknown): Promise<T> => request<T>("PATCH", url, body ?? {});
export const apiDelete = <T>(url: string): Promise<T> => request<T>("DELETE", url);

/** Upload an image (≤4MB, jpeg/png/webp) → returns its public URL (/api/uploads/<id>). */
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: fd });
  } catch {
    throw new Error("Network error during upload.");
  }
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !data?.url) throw new Error(data?.error ?? "Upload failed.");
  return data.url;
}

// ───────────────────────── shared value types ─────────────────────────

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "UNPAID" | "PAID_CONFIRMED" | "REFUNDED";

export type ShipmentStatus = "PENDING" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "EXCEPTION" | "RETURNED";

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

export const PAYMENT_STATUSES: PaymentStatus[] = ["UNPAID", "PAID_CONFIRMED", "REFUNDED"];

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "PENDING",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
  "RETURNED",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pending payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  READY_TO_SHIP: "Ready to ship",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID_CONFIRMED: "Paid",
  REFUNDED: "Refunded",
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Pending",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Exception",
  RETURNED: "Returned",
};

// Legal forward transitions (mirror of server-side map — server still enforces).
export const ORDER_TRANSITIONS: Record<string, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["READY_TO_SHIP", "CANCELLED", "REFUNDED"],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

// ───────────────────────── endpoint payload types ─────────────────────────

// GET /api/webmaster/stats
export interface StatsOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  totalCents: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
}
export interface StatsResponse {
  stats: {
    totalOrders: number;
    pendingOrders: number;
    toShip: number;
    revenueCents: number;
    monthRevenueCents: number;
    lastMonthRevenueCents: number;
    customerCount: number;
    productCount: number;
  };
  recentOrders: StatsOrder[];
  bestSellers: { name: string; quantity: number }[];
  lowStock: {
    id: string;
    sku: string;
    stock: number;
    size: string | null;
    color: string | null;
    product: { name: string };
  }[];
  trend: { date: string; revenue: number }[];
  telegramHealth: "HEALTHY" | "DEGRADED" | "FAILING" | "NOT_CONFIGURED";
  notifications: NotificationDelivery[];
}

// Products
export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  skuBase: string;
  priceCents: number;
  salePriceCents: number | null;
  isActive: boolean;
  archivedAt: string | null;
  image: string | null;
  totalStock: number;
  variantCount: number;
  categories: string[];
  createdAt: string;
}
export interface ProductListResponse {
  total: number;
  page: number;
  pageSize: number;
  products: ProductListItem[];
}
export interface ProductVariantInput {
  id?: string;
  size?: string;
  color?: string;
  sku: string;
  stock: number;
  priceDeltaCents: number;
}
export interface ProductImageInput {
  url: string;
  alt?: string;
}
export interface ProductPayload {
  name: string;
  slug: string;
  description: string;
  details?: string;
  priceCents: number;
  salePriceCents?: number | null;
  skuBase: string;
  material?: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  categoryIds: string[];
  images: ProductImageInput[];
  variants: ProductVariantInput[];
}
export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  details: string | null;
  priceCents: number;
  salePriceCents: number | null;
  skuBase: string;
  material: string | null;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  archivedAt: string | null;
  images: { id: string; url: string; alt: string | null; position: number }[];
  variants: {
    id: string;
    size: string | null;
    color: string | null;
    sku: string;
    stock: number;
    priceDeltaCents: number;
  }[];
  categoryIds: string[];
}

// Categories
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}
export interface CategoryPayload {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  position: number;
  isActive: boolean;
}

// Orders
export interface OrderListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  totalCents: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: { name: string; quantity: number }[];
  shipment: { trackingNumber: string | null; status: ShipmentStatus; courierName: string | null } | null;
}
export interface OrderListResponse {
  total: number;
  page: number;
  pageSize: number;
  orders: OrderListItem[];
}
export interface OrderDetail {
  id: string;
  orderNumber: string;
  userId: string | null;
  email: string;
  phone: string;
  customerName: string;
  shippingAddress: string; // JSON string
  shippingMethod: string | null;
  shippingCostCents: number;
  subtotalCents: number;
  totalCents: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  customerNote: string | null;
  adminNote: string | null;
  cancellationReason: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: {
    id: string;
    name: string;
    sku: string;
    size: string | null;
    color: string | null;
    imageUrl: string | null;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }[];
  statusHistory: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    actorType: string;
    actorLabel: string | null;
    createdAt: string;
  }[];
  paymentRecords: {
    id: string;
    method: string;
    amountCents: number;
    reference: string | null;
    note: string | null;
    confirmedAt: string;
  }[];
  shipment: {
    id: string;
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: ShipmentStatus;
    estimatedDelivery: string | null;
    note: string | null;
    createdAt: string;
    statusHistory: { id: string; status: ShipmentStatus; note: string | null; createdAt: string }[];
  } | null;
}
export interface OrderDetailResponse {
  order: OrderDetail;
  customer: { id: string; email: string; name: string; phone: string | null; createdAt: string } | null;
}

// Customers
export interface CustomerListItem {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
}
export interface CustomerListResponse {
  total: number;
  page: number;
  pageSize: number;
  customers: CustomerListItem[];
}
export interface CustomerDetailResponse {
  customer: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
  };
  orders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    totalCents: number;
    createdAt: string;
  }[];
}

// Shipping
export interface Courier {
  id: string;
  name: string;
  code: string;
  description: string | null;
  trackingUrlTemplate: string | null;
  minDays: number | null;
  maxDays: number | null;
  isActive: boolean;
  position: number;
  rates: ShippingRate[];
  _count?: { rates: number };
}
export interface CourierPayload {
  name: string;
  code: string;
  description?: string;
  trackingUrlTemplate?: string;
  minDays?: number | null;
  maxDays?: number | null;
  isActive: boolean;
  position: number;
}
export interface ShippingRate {
  id: string;
  courierId: string;
  name: string;
  type: "FLAT" | "REGION";
  region: string;
  rateCents: number;
  freeAboveCents: number | null;
  isActive: boolean;
  courier?: { name: string };
}
export interface ShippingRatePayload {
  courierId: string;
  name: string;
  type: "FLAT" | "REGION";
  region?: string;
  rateCents: number;
  freeAboveCents?: number | null;
  isActive: boolean;
}

// Content
export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  position: number;
  isActive: boolean;
}
export interface BannerPayload {
  title: string;
  subtitle?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  position: number;
  isActive: boolean;
}
export interface ContentPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  isPublished: boolean;
  showInFooter: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ContentPagePayload {
  title: string;
  slug: string;
  content: string;
  isPublished: boolean;
  showInFooter: boolean;
  seoTitle?: string;
  seoDescription?: string;
}
export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface FaqPayload {
  question: string;
  answer: string;
  position: number;
  isActive: boolean;
}

// Notifications
export interface NotificationDelivery {
  id: string;
  event: string;
  status: "PENDING" | "SENT" | "FAILED";
  target: string | null;
  attempts: number;
  lastError: string | null;
  orderId: string | null;
  createdAt: string;
}
export interface NotificationsResponse {
  deliveries: NotificationDelivery[];
  counters: { sent: number; failed: number; pending: number };
}
export type TelegramConfigSource = "database" | "env" | "none";
export interface TelegramStatusResponse {
  configured: boolean;
  source: TelegramConfigSource;
  tokenMasked: string | null;
  chatIdMasked: string | null;
}

// Audit
export interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: string | null;
  createdAt: string;
}

// Setup
export interface SetupStatusResponse {
  setupRequired: boolean;
}

// ───────────────────────── formatting utilities ─────────────────────────

/** cents → currency-unit string for inputs ("" when null). */
export function centsToUnits(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return String(cents / 100);
}

/** currency-unit input string → cents (null when empty/invalid). */
export function unitsToCents(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Parse the order.shippingAddress JSON snapshot safely. */
export interface ParsedAddress {
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  fullName?: string;
  phone?: string;
}
export function parseAddress(json: string): ParsedAddress | null {
  try {
    const v = JSON.parse(json) as ParsedAddress;
    return typeof v === "object" && v !== null ? v : null;
  } catch {
    return null;
  }
}

export function truncate(s: string | null | undefined, max = 60): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
