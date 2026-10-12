// Central Zod validation schemas — every API route parses input through these.
// Status enums mirror prisma schema (String columns, validated here).

import { z } from "zod";

// ───────────────────────── constants ─────────────────────────

export const ROLES = ["CUSTOMER", "OWNER", "ADMIN", "ORDER_MANAGER", "CONTENT_MANAGER"] as const;
export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;
export const PAYMENT_STATUSES = ["UNPAID", "PAID_CONFIRMED", "REFUNDED"] as const;
export const SHIPMENT_STATUSES = [
  "PENDING",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
  "RETURNED",
] as const;
export const RATE_TYPES = ["FLAT", "REGION"] as const;

// Legal forward transitions for order.status — anything else is rejected server-side.
export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["READY_TO_SHIP", "CANCELLED", "REFUNDED"],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["COMPLETED", "RETURNED" as string].filter((s) =>
    ORDER_STATUSES.includes(s as never)
  ),
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

// ───────────────────────── auth ─────────────────────────

export const registerSchema = z.object({
  name: z.string().min(2, "Name is too short.").max(80),
  email: z.string().email().max(160),
  phone: z.string().min(6).max(24).optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(160),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(120),
  password: z.string().min(8).max(72),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(6).max(24).optional().or(z.literal("")),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

// ───────────────────────── addresses ─────────────────────────

export const addressSchema = z.object({
  label: z.string().max(40).optional().or(z.literal("")),
  fullName: z.string().min(2).max(80),
  phone: z.string().min(6).max(24),
  line1: z.string().min(4).max(160),
  line2: z.string().max(160).optional().or(z.literal("")),
  city: z.string().min(2).max(80),
  province: z.string().min(2).max(80),
  postalCode: z.string().min(3).max(12),
  country: z.string().min(2).max(60).default("Indonesia"),
  isDefault: z.boolean().default(false),
});

// ───────────────────────── checkout ─────────────────────────

export const checkoutSchema = z.object({
  idempotencyKey: z.string().uuid(),
  email: z.string().email().max(160),
  phone: z.string().min(6).max(24),
  customerName: z.string().min(2).max(80),
  shippingAddress: z.object({
    line1: z.string().min(4).max(160),
    line2: z.string().max(160).optional().or(z.literal("")),
    city: z.string().min(2).max(80),
    province: z.string().min(2).max(80),
    postalCode: z.string().min(3).max(12),
    country: z.string().min(2).max(60),
    notes: z.string().max(500).optional().or(z.literal("")),
  }),
  shippingRateId: z.string().min(1),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1)
    .max(50),
  saveAddress: z.boolean().optional().default(false),
});

export const trackSchema = z.object({
  orderNumber: z.string().min(4).max(40),
  email: z.string().email().max(160),
});

// ───────────────────────── webmaster: catalog ─────────────────────────

export const productSchema = z.object({
  name: z.string().min(2).max(140),
  slug: z
    .string()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case."),
  description: z.string().min(10).max(5000),
  details: z.string().max(5000).optional().or(z.literal("")),
  priceCents: z.number().int().min(100).max(100000000_00),
  salePriceCents: z.number().int().min(0).nullable().optional(),
  skuBase: z.string().min(2).max(40),
  material: z.string().max(160).optional().or(z.literal("")),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isActive: z.boolean().default(true),
  categoryIds: z.array(z.string()).max(10).default([]),
  images: z
    .array(
      z.object({
        url: z.string().min(1).max(500),
        alt: z.string().max(200).optional().or(z.literal("")),
      })
    )
    .max(8)
    .default([]),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        size: z.string().max(40).optional().or(z.literal("")),
        color: z.string().max(40).optional().or(z.literal("")),
        sku: z.string().min(2).max(60),
        stock: z.number().int().min(0).max(100000),
        priceDeltaCents: z.number().int().min(0).default(0),
      })
    )
    .min(1)
    .max(60),
});

export const categorySchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(600).optional().or(z.literal("")),
  imageUrl: z.string().max(500).optional().or(z.literal("")),
  position: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

// ───────────────────────── webmaster: orders & shipping ─────────────────────────

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const paymentConfirmSchema = z.object({
  reference: z.string().max(120).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const orderNoteSchema = z.object({
  adminNote: z.string().max(1000),
});

export const shipmentUpsertSchema = z.object({
  courierId: z.string().min(1),
  trackingNumber: z.string().max(80).optional().or(z.literal("")),
  estimatedDelivery: z.string().max(80).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const shipmentStatusSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const courierSchema = z.object({
  name: z.string().min(2).max(80),
  code: z
    .string()
    .min(2)
    .max(24)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters/numbers/underscore."),
  description: z.string().max(400).optional().or(z.literal("")),
  trackingUrlTemplate: z
    .string()
    .max(300)
    .refine((v) => !v || v.includes("{trackingNumber}"), {
      message: "Template must include the {trackingNumber} placeholder.",
    })
    .optional()
    .or(z.literal("")),
  minDays: z.number().int().min(0).max(90).nullable().optional(),
  maxDays: z.number().int().min(0).max(90).nullable().optional(),
  isActive: z.boolean().default(true),
  position: z.number().int().min(0).max(99).default(0),
});

export const shippingRateSchema = z.object({
  courierId: z.string().min(1),
  name: z.string().min(2).max(80),
  type: z.enum(RATE_TYPES),
  region: z.string().max(80).default("*"),
  rateCents: z.number().int().min(0).max(10000000),
  freeAboveCents: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
});

// ───────────────────────── webmaster: content ─────────────────────────

export const bannerSchema = z.object({
  title: z.string().min(2).max(120),
  subtitle: z.string().max(240).optional().or(z.literal("")),
  imageUrl: z.string().min(1).max(500),
  mobileImageUrl: z.string().max(500).optional().or(z.literal("")),
  ctaText: z.string().max(60).optional().or(z.literal("")),
  ctaUrl: z.string().max(300).optional().or(z.literal("")),
  position: z.number().int().min(0).max(99).default(0),
  isActive: z.boolean().default(true),
});

export const contentPageSchema = z.object({
  title: z.string().min(2).max(140),
  slug: z
    .string()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  content: z.string().min(1).max(50000),
  isPublished: z.boolean().default(false),
  showInFooter: z.boolean().default(true),
  seoTitle: z.string().max(200).optional().or(z.literal("")),
  seoDescription: z.string().max(300).optional().or(z.literal("")),
});

export const faqSchema = z.object({
  question: z.string().min(4).max(300),
  answer: z.string().min(2).max(3000),
  position: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const settingsUpdateSchema = z.object({
  storeName: z.string().min(1).max(80).optional(),
  tagline: z.string().max(160).optional(),
  logoText: z.string().min(1).max(80).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  announcementText: z.string().max(240).optional(),
  announcementEnabled: z.boolean().optional(),
  currency: z.string().min(2).max(6).optional(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().max(60).optional(),
  orderNumberPrefix: z.string().min(1).max(8).regex(/^[A-Z0-9]+$/).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).optional(),
  contactAddress: z.string().max(300).optional(),
  social: z
    .object({
      instagram: z.string().max(200).optional(),
      tiktok: z.string().max(200).optional(),
      facebook: z.string().max(200).optional(),
      x: z.string().max(200).optional(),
    })
    .optional(),
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(320).optional(),
  ogImageUrl: z.string().max(500).nullable().optional(),
  maintenanceEnabled: z.boolean().optional(),
  maintenanceMessage: z.string().max(300).optional(),
  registrationEnabled: z.boolean().optional(),
  enforceStock: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).max(1000).optional(),
  paymentInstructions: z.string().max(2000).optional(),
  cancellationNote: z.string().max(600).optional(),
  freeShippingAboveCents: z.number().int().min(0).nullable().optional(),
  newsletterEnabled: z.boolean().optional(),
  homepage: z
    .object({
      heroHeadline: z.string().max(120).optional(),
      heroSubline: z.string().max(240).optional(),
      showCategories: z.boolean().optional(),
      showNewArrivals: z.boolean().optional(),
      showBestSellers: z.boolean().optional(),
      showEditorial: z.boolean().optional(),
    })
    .optional(),
  navItems: z
    .array(z.object({ label: z.string().min(1).max(40), href: z.string().min(1).max(200) }))
    .max(12)
    .optional(),
  footerAbout: z.string().max(600).optional(),
  // Managed social media accounts (footer). Absolute http(s) URLs only.
  socialLinks: z
    .array(
      z.object({
        platform: z.string().trim().min(1, "Platform name is required.").max(40),
        url: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .regex(/^https?:\/\/\S+$/i, "Social link must be an absolute http(s) URL."),
      })
    )
    .max(12)
    .optional(),
  // Footer presentation — column titles, quick-link columns, texts.
  footer: z
    .object({
      careTitle: z.string().trim().max(40).optional(),
      shopTitle: z.string().trim().max(40).optional(),
      contactTitle: z.string().trim().max(40).optional(),
      hours: z.string().max(120).optional(),
      bottomNote: z.string().max(160).optional(),
      newsletterTitle: z.string().max(80).optional(),
      newsletterSubtitle: z.string().max(240).optional(),
      customerCare: z
        .array(z.object({ label: z.string().min(1).max(40), href: z.string().min(1).max(200) }))
        .max(12)
        .optional(),
      shop: z
        .array(z.object({ label: z.string().min(1).max(40), href: z.string().min(1).max(200) }))
        .max(12)
        .optional(),
    })
    .optional(),
});

export const customerAdminSchema = z.object({
  isActive: z.boolean().optional(),
});

// Telegram credentials (stored in DB via /webmaster/notifications).
// Empty string = "leave unchanged"; explicit clearing uses the DELETE endpoint.
export const telegramConfigSchema = z.object({
  botToken: z
    .string()
    .trim()
    .max(80)
    .regex(/^\d{5,}:[A-Za-z0-9_-]{20,}$/, "Invalid Bot Token format — copy it exactly from @BotFather (e.g. 123456789:AAE…).")
    .or(z.literal(""))
    .optional(),
  chatId: z
    .string()
    .trim()
    .max(64)
    .regex(
      /^-?\d{1,25}$|^@[A-Za-z0-9_]{4,64}$/,
      "Chat ID must be numeric (e.g. 123456789 or -1001234567890 for groups/channels) or @channelusername."
    )
    .or(z.literal(""))
    .optional(),
});

// ───────────────────────── misc ─────────────────────────

export const newsletterSchema = z.object({
  email: z.string().email().max(160),
});

export type ProductInput = z.infer<typeof productSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
