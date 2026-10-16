// Role-based capability map — enforced SERVER-SIDE on every webmaster API route.
// UI never grants access; it only reflects what the server would allow.

import type { Role } from "@/lib/auth";

export type Capability =
  | "orders"
  | "customers"
  | "products"
  | "categories"
  | "banners"
  | "pages"
  | "faq"
  | "shipping"
  | "settings"
  | "notifications"
  | "audit"
  | "media";

export const CAPABILITIES: Record<Role, Capability[] | "*"> = {
  OWNER: "*",
  ADMIN: [
    "orders",
    "customers",
    "products",
    "categories",
    "banners",
    "pages",
    "faq",
    "shipping",
    "settings",
    "notifications",
    "audit",
    "media",
  ],
  ORDER_MANAGER: ["orders", "customers", "shipping", "notifications", "audit"],
  CONTENT_MANAGER: ["products", "categories", "banners", "pages", "faq", "media"],
  CUSTOMER: [],
};

export function can(role: Role, capability: Capability): boolean {
  const caps = CAPABILITIES[role];
  return caps === "*" || caps.includes(capability);
}
