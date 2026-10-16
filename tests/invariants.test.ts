/// <reference types="bun-types" />
// PRODUCTION READINESS AUDIT — critical business invariant tests (audit Phase 3).
// Runner: `bun test tests/` (Bun's built-in runner — zero extra dependencies).
//
// Isolation contract:
//  - A throwaway SQLite database is created in os.tmpdir() per run and pushed
//    with `prisma db push`; the app's real db/custom.db is NEVER touched.
//  - No network access: global fetch is stubbed (Telegram deliveries resolve
//    in-process; the I-7 test flips the stub to a failing transport).
//  - next/headers is mocked with an in-memory cookie jar so real route
//    handlers / server components run with controllable sessions.

import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { execSync } from "child_process";
import { randomBytes, createHash } from "crypto";
import { rmSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import type { TelegramConfigStatus } from "@/lib/telegram-config";

// ── mocks BEFORE any app import ──────────────────────────────────────────────

// 1. "server-only" throws outside a React Server Component bundler — neutralize.
mock.module("server-only", () => ({}));

// 2. In-memory cookie jar standing in for next/headers.
const cookieJar = new Map<string, string>();
mock.module("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
  headers: async () => new Headers(),
}));

// 3. Network stub — every Telegram delivery "succeeds" instantly; I-7 replaces
//    it with a failing transport and restores it afterwards.
const realFetch = globalThis.fetch;
// Bun types fetch with a preconnect method — plain stubs cast through unknown.
globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;

// ── isolated database ────────────────────────────────────────────────────────

const TEST_DB = join("/tmp", `maison-elan-audit-${Date.now()}-${randomBytes(3).toString("hex")}.db`);
process.env.DATABASE_URL = `file:${TEST_DB}`;
process.env.APP_URL = "http://localhost:3000";

beforeAll(() => {
  execSync("bunx prisma db push --skip-generate", {
    cwd: "/home/z/my-project",
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    stdio: "pipe",
  });
});

afterAll(() => {
  rmSync(TEST_DB, { force: true });
  rmSync(`${TEST_DB}-journal`, { force: true });
  globalThis.fetch = realFetch;
});

// ── lazily imported app modules (after env + mocks) ──────────────────────────

// Route handlers imported dynamically get a loose signature here: the tests
// call them with concrete NextRequest args, while the modules themselves have
// precise handler types (this file is linted + type-checked but never bundled).
type Route = Record<string, (...args: never[] | unknown[]) => unknown>;
let db: import("@prisma/client").PrismaClient;
let ordersRoute: Route;
let trackRoute: Route;
let wmOrdersRoute: Route;
let wmCustomersRoute: Route;
let wmTelegramRoute: Route;
let healthRoute: Route;
let successPage: (props: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ email?: string }>;
}) => Promise<unknown>;
let handleError: (err: unknown) => Response;
let getTelegramCredentials: () => Promise<TelegramConfigStatus>;
let PrismaNS: typeof import("@prisma/client").Prisma;

// fixtures
let vStock5: { id: string; productId: string };
let vStock2: { id: string };
let vOpen: { id: string };
let rate: { id: string };
let userA: { id: string; email: string };
let userB: { id: string; email: string };
let staffOM: { id: string; email: string };
let staffCM: { id: string; email: string };
let orderA: { id: string; orderNumber: string; email: string; userId: string };
let guestOrder: { id: string; orderNumber: string; email: string };

const OM_COOKIE = "om-raw-token";
const CM_COOKIE = "cm-raw-token";
const A_COOKIE = "a-raw-token";
const B_COOKIE = "b-raw-token";

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function setCookie(raw: string | null) {
  cookieJar.delete("me_session");
  if (raw) cookieJar.set("me_session", raw);
}

function req(
  path: string,
  init?: { method?: string; body?: string; ip?: string; headers?: Record<string, string> }
): NextRequest {
  const headers = new Headers(init?.headers);
  headers.set("x-forwarded-for", init?.ip ?? `10.1.${randomBytes(1)[0]}.${randomBytes(1)[0]}`);
  return new NextRequest(`http://localhost${path}`, {
    method: init?.method,
    body: init?.body,
    headers,
  });
}

// Deep-search a React element tree for a string (cycle-safe, skips functions).
function deepFind(obj: unknown, needle: string, seen = new Set<unknown>()): boolean {
  if (obj == null) return false;
  if (typeof obj === "string") return obj.includes(needle);
  if (typeof obj === "number") return String(obj).includes(needle);
  if (typeof obj !== "object" || seen.has(obj)) return false;
  seen.add(obj);
  return Object.values(obj as Record<string, unknown>).some((v) => deepFind(v, needle, seen));
}

// Next's notFound() rejects with an error whose digest is
// "NEXT_HTTP_ERROR_FALLBACK;404" — assert on that, not the message.
async function expect404(p: Promise<unknown>) {
  try {
    await p;
    throw new Error("expected notFound() but the page rendered");
  } catch (e) {
    const err = e as Error & { digest?: string };
    expect(String(err.digest ?? err.message ?? err)).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
  }
}

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

const checkoutBody = (over: Record<string, unknown> = {}) => ({
  idempotencyKey: uuid(),
  email: "guest@test.dev",
  phone: "081234567890",
  customerName: "Test Guest",
  shippingAddress: {
    line1: "Jl. Test No. 1",
    city: "Jakarta",
    province: "DKI Jakarta",
    postalCode: "12190",
    country: "Indonesia",
  },
  shippingRateId: rate.id,
  items: [{ variantId: vStock5.id, quantity: 1 }],
  ...over,
});

async function checkout(over: Record<string, unknown> = {}, ip?: string) {
  const res = (await ordersRoute.POST(
    req("/api/orders", { method: "POST", body: JSON.stringify(checkoutBody(over)), ip })
  )) as Response;
  return res;
}

// ═════════════════════════════════════════════════════════════════════════════

beforeAll(async () => {
  const dbMod = await import("@/lib/db");
  db = (dbMod as { db: import("@prisma/client").PrismaClient }).db;

  ordersRoute = (await import("@/app/api/orders/route")) as unknown as Route;
  trackRoute = (await import("@/app/api/track/route")) as unknown as Route;
  wmOrdersRoute = (await import("@/app/api/webmaster/orders/[id]/route")) as unknown as Route;
  wmCustomersRoute = (await import("@/app/api/webmaster/customers/route")) as unknown as Route;
  wmTelegramRoute = (await import("@/app/api/webmaster/telegram/config/route")) as unknown as Route;
  healthRoute = (await import("@/app/api/health/route")) as unknown as Route;
  successPage = (await import("@/app/(storefront)/checkout/success/[orderNumber]/page"))
    .default as typeof successPage;
  const helpers = await import("@/lib/api-helpers");
  handleError = helpers.handleError as typeof handleError;
  const tg = await import("@/lib/telegram-config");
  getTelegramCredentials = tg.getTelegramCredentials;
  const prismaMod = await import("@prisma/client");
  PrismaNS = prismaMod.Prisma;

  // ── fixtures (write directly to the throwaway DB) ──
  const courier = await db.courier.create({
    data: { name: "TestCourier", code: "TST", isActive: true, position: 0 },
  });
  rate = await db.shippingRate.create({
    data: {
      courierId: courier.id,
      name: "Reguler",
      type: "FLAT",
      region: "*",
      rateCents: 20000,
      isActive: true,
    },
  });
  const product = await db.product.create({
    data: {
      name: "Test Silk Scarf",
      slug: `test-silk-scarf-${randomBytes(2).toString("hex")}`,
      description: "A test product.",
      priceCents: 150000,
      skuBase: "TSC",
      isActive: true,
    },
  });
  vStock5 = await db.productVariant.create({
    data: { productId: product.id, sku: "TSC-001", stock: 5 },
  });
  vStock2 = await db.productVariant.create({
    data: { productId: product.id, sku: "TSC-002", stock: 2 },
  });
  vOpen = await db.productVariant.create({
    data: { productId: product.id, sku: "TSC-003", stock: 50 },
  });

  const mkUser = (email: string, role: string) =>
    db.user.create({
      data: {
        email,
        passwordHash: "x",
        name: email.split("@")[0],
        role,
      },
    });
  userA = await mkUser("cust-a@test.dev", "CUSTOMER");
  userB = await mkUser("cust-b@test.dev", "CUSTOMER");
  staffOM = await mkUser("om@test.dev", "ORDER_MANAGER");
  staffCM = await mkUser("cm@test.dev", "CONTENT_MANAGER");

  for (const [raw, user] of [
    [A_COOKIE, userA],
    [B_COOKIE, userB],
    [OM_COOKIE, staffOM],
    [CM_COOKIE, staffCM],
  ] as const) {
    await db.session.create({
      data: { token: sha256(raw), userId: user.id, expiresAt: new Date(Date.now() + 86400_000) },
    });
  }
});

// ── I-9: notification config isolation ───────────────────────────────────────

describe("I-9: notification config isolation", () => {
  test("unconfigured store resolves source=none and never leaks secrets", async () => {
    const creds = (await getTelegramCredentials()) as { source: string; configured: boolean; tokenMasked: string };
    expect(creds.source).toBe("none");
    expect(creds.configured).toBe(false);
    expect(creds.tokenMasked).toBeFalsy();
  });

  test("env credentials resolve with source=env; DB row wins over env (source=database)", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "111:ENV-TOKEN";
    process.env.TELEGRAM_CHAT_ID = "777";
    const envCreds = (await getTelegramCredentials()) as { source: string };
    expect(envCreds.source).toBe("env");

    await db.storeSetting.create({
      data: {
        id: "telegram",
        data: JSON.stringify({ botToken: "222:DB-TOKEN", chatId: "42" }),
      },
    });
    const dbCreds = (await getTelegramCredentials()) as { source: string; configured: boolean };
    expect(dbCreds.source).toBe("database");
    expect(dbCreds.configured).toBe(true);

    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });
});

// ── I-1: client-submitted prices cannot override server totals ───────────────

describe("I-1: server-side pricing", () => {
  test("injected price fields are stripped; totals recomputed from DB", async () => {
    const res = await checkout({
      totalCents: 1,
      subtotalCents: 1,
      shippingCostCents: 0,
      items: [{ variantId: vStock5.id, quantity: 1, unitPriceCents: 1, priceCents: 1 }],
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { totalCents: number; subtotalCents: number; shippingCostCents: number };
    // DB: unit 150000 (no sale price), shipping 20000 — client "1" values ignored
    expect(body.subtotalCents).toBe(150000);
    expect(body.shippingCostCents).toBe(20000);
    expect(body.totalCents).toBe(170000);

    const item = await db.orderItem.findFirstOrThrow({ where: { variantId: vStock5.id } });
    expect(item.unitPriceCents).toBe(150000);
    expect(item.lineTotalCents).toBe(150000);
  });

  test("unknown/invalid shippingRateId is rejected (shipping re-quoted from DB)", async () => {
    const res = await checkout({ shippingRateId: "made-up-rate-id" });
    expect(res.status).toBe(400);
  });
});

// ── I-2: concurrent checkouts cannot oversell inventory ──────────────────────

describe("I-2: oversell protection", () => {
  test("two concurrent checkouts of stock=2, qty=2 → exactly one succeeds, stock ends at 0", async () => {
    const [r1, r2] = await Promise.all([checkout({ items: [{ variantId: vStock2.id, quantity: 2 }] }, "10.9.9.1"), checkout({ items: [{ variantId: vStock2.id, quantity: 2 }] }, "10.9.9.2")]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const variant = await db.productVariant.findUniqueOrThrow({ where: { id: vStock2.id } });
    expect(variant.stock).toBe(0);
    const orders = await db.order.count({ where: { items: { some: { variantId: vStock2.id } } } });
    expect(orders).toBe(1);
  });
});

// ── I-3: repeated checkout requests do not create duplicate orders ───────────

describe("I-3: checkout idempotency", () => {
  test("same idempotencyKey twice sequentially returns the SAME order, count stays 1", async () => {
    const key = uuid();
    const r1 = await checkout({ idempotencyKey: key, items: [{ variantId: vOpen.id, quantity: 1 }] });
    expect(r1.status).toBe(201);
    const r2 = await checkout({ idempotencyKey: key, items: [{ variantId: vOpen.id, quantity: 1 }] });
    expect(r2.status).toBe(201);
    const b1 = (await r1.json()) as { orderNumber: string };
    const b2 = (await r2.json()) as { orderNumber: string };
    expect(b1.orderNumber).toBe(b2.orderNumber);
    expect(await db.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  test("2 concurrent retries with one key → exactly one order row exists", async () => {
    const key = uuid();
    const results = await Promise.all([
      checkout({ idempotencyKey: key, items: [{ variantId: vOpen.id, quantity: 1 }] }, "10.8.8.1"),
      checkout({ idempotencyKey: key, items: [{ variantId: vOpen.id, quantity: 1 }] }, "10.8.8.2"),
    ]);
    for (const r of results) {
      expect([200, 201, 409]).toContain(r.status); // duplicate either replays (201) or conflicts (409)
    }
    const numbers = new Set<string>();
    for (const r of results) {
      if (r.status === 201) {
        const b = (await r.json()) as { orderNumber: string };
        numbers.add(b.orderNumber);
      }
    }
    expect(numbers.size).toBeLessThanOrEqual(1);
    expect(await db.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });
});

// ── I-4: customers cannot read another customer's order ──────────────────────

describe("I-4: order ownership & scoping", () => {
  beforeAll(async () => {
    setCookie(A_COOKIE);
    const res = await checkout({ email: userA.email, customerName: "Customer A" });
    expect(res.status).toBe(201);
    const b = (await res.json()) as { orderNumber: string };
    orderA = { ...b, email: userA.email, userId: userA.id, id: "" };
    const row = await db.order.findUniqueOrThrow({ where: { orderNumber: b.orderNumber } });
    orderA.id = row.id;

    // guest order — drop the session so it is truly a guest (userId = null)
    setCookie(null);
    const g = await checkout({ email: "guest-owned@test.dev", customerName: "Guest Owner" });
    expect(g.status).toBe(201);
    const gb = (await g.json()) as { orderNumber: string };
    guestOrder = { ...gb, email: "guest-owned@test.dev", id: "" };
    const grow = await db.order.findUniqueOrThrow({ where: { orderNumber: gb.orderNumber } });
    guestOrder.id = grow.id;
  });

  test("GET /api/orders is scoped to the signed-in customer", async () => {
    setCookie(A_COOKIE);
    const resA = (await ordersRoute.GET()) as Response;
    const bodyA = (await resA.json()) as { orders: { orderNumber: string }[] };
    expect(resA.status).toBe(200);
    expect(bodyA.orders.some((o) => o.orderNumber === orderA.orderNumber)).toBe(true);

    setCookie(B_COOKIE);
    const resB = (await ordersRoute.GET()) as Response;
    const bodyB = (await resB.json()) as { orders: { orderNumber: string }[] };
    expect(resB.status).toBe(200);
    expect(bodyB.orders.some((o) => o.orderNumber === orderA.orderNumber)).toBe(false);
  });

  test("anonymous GET /api/orders → 401", async () => {
    setCookie(null);
    const res = (await ordersRoute.GET()) as Response;
    expect(res.status).toBe(401);
  });

  test("public tracking requires orderNumber AND matching email (2-factor)", async () => {
    const good = (await trackRoute.POST(
      req("/api/track", {
        method: "POST",
        body: JSON.stringify({ orderNumber: guestOrder.orderNumber, email: guestOrder.email }),
      })
    )) as Response;
    expect(good.status).toBe(200);

    const bad = (await trackRoute.POST(
      req("/api/track", {
        method: "POST",
        body: JSON.stringify({ orderNumber: guestOrder.orderNumber, email: "attacker@test.dev" }),
      })
    )) as Response;
    expect(bad.status).toBe(404);
    const badBody = (await bad.json()) as { error: string };
    expect(badBody.error).not.toContain(guestOrder.email);
  });

  test("checkout success page: guest order needs matching ?email=, owner order needs the owner session", async () => {
    // guest order, wrong email → 404 fallback
    setCookie(null);
    await expect404(
      successPage({
        params: Promise.resolve({ orderNumber: guestOrder.orderNumber }),
        searchParams: Promise.resolve({ email: "wrong@test.dev" }),
      })
    );

    // guest order, missing email → 404 fallback
    await expect404(
      successPage({
        params: Promise.resolve({ orderNumber: guestOrder.orderNumber }),
        searchParams: Promise.resolve({}),
      })
    );

    // guest order, matching email → renders
    const okPage = await successPage({
      params: Promise.resolve({ orderNumber: guestOrder.orderNumber }),
      searchParams: Promise.resolve({ email: guestOrder.email }),
    });
    expect(deepFind(okPage, guestOrder.orderNumber)).toBe(true);

    // registered order: customer B's session must NOT see customer A's order
    setCookie(B_COOKIE);
    await expect404(
      successPage({
        params: Promise.resolve({ orderNumber: orderA.orderNumber }),
        searchParams: Promise.resolve({ email: orderA.email }),
      })
    );

    // registered order: owner session renders
    setCookie(A_COOKIE);
    const ownPage = await successPage({
      params: Promise.resolve({ orderNumber: orderA.orderNumber }),
      searchParams: Promise.resolve({}),
    });
    expect(deepFind(ownPage, orderA.orderNumber)).toBe(true);
  });
});

// ── I-5: unauthorized users cannot execute webmaster actions ─────────────────

describe("I-5: webmaster authorization", () => {
  const patchOrder = (cookie: string | null) => {
    setCookie(cookie);
    return wmOrdersRoute.PATCH(
      req(`/api/webmaster/orders/${orderA.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "status", status: "PAID" }),
      }),
      { params: Promise.resolve({ id: orderA.id }) }
    ) as Promise<Response>;
  };

  test("anonymous → 401", async () => {
    expect((await patchOrder(null)).status).toBe(401);
  });

  test("CUSTOMER → 403", async () => {
    expect((await patchOrder(B_COOKIE)).status).toBe(403);
  });

  test("CONTENT_MANAGER lacks the orders capability → 403", async () => {
    expect((await patchOrder(CM_COOKIE)).status).toBe(403);
  });

  test("ORDER_MANAGER (orders capability) → allowed; audit row written", async () => {
    const res = (await patchOrder(OM_COOKIE)) as Response;
    expect(res.status).toBe(200);
    const auditRow = await db.adminAuditLog.findFirst({
      where: { action: "ORDER_STATUS_CHANGE", entityId: orderA.id },
    });
    expect(auditRow).not.toBeNull();
  });

  test("ORDER_MANAGER lacks products capability → GET /api/webmaster/products would 403", async () => {
    // capability matrix: ORDER_MANAGER has orders/customers/shipping/notifications/audit only
    const { can } = await import("@/lib/permissions");
    expect(can("ORDER_MANAGER", "orders")).toBe(true);
    expect(can("ORDER_MANAGER", "products")).toBe(false);
    expect(can("CONTENT_MANAGER", "orders")).toBe(false);
    expect(can("OWNER", "audit")).toBe(true);
  });
});

// ── I-6: invalid order status transitions are rejected ───────────────────────

describe("I-6: order state machine", () => {
  test("PENDING_PAYMENT → SHIPPED rejected with 409 and no write", async () => {
    setCookie(OM_COOKIE);
    const res = (await wmOrdersRoute.PATCH(
      req(`/api/webmaster/orders/${orderA.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "status", status: "SHIPPED" }),
      }),
      { params: Promise.resolve({ id: orderA.id }) }
    )) as Response;
    expect(res.status).toBe(409);
    const row = await db.order.findUniqueOrThrow({ where: { id: orderA.id } });
    expect(row.status).toBe("PAID"); // set by the I-5 test, unchanged here
  });

  test("COMPLETED → CANCELLED (terminal jump) rejected with 409", async () => {
    const done = await db.order.create({
      data: {
        orderNumber: `ME-TEST-${randomBytes(2).toString("hex")}`,
        idempotencyKey: uuid(),
        email: "done@test.dev",
        phone: "081234567890",
        customerName: "Done",
        shippingAddress: "{}",
        subtotalCents: 100,
        totalCents: 100,
        status: "COMPLETED",
      },
    });
    setCookie(OM_COOKIE);
    const res = (await wmOrdersRoute.PATCH(
      req(`/api/webmaster/orders/${done.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "status", status: "CANCELLED" }),
      }),
      { params: Promise.resolve({ id: done.id }) }
    )) as Response;
    expect(res.status).toBe(409);
    const row = await db.order.findUniqueOrThrow({ where: { id: done.id } });
    expect(row.status).toBe("COMPLETED");
    expect(row.cancelledAt).toBeNull();
  });
});

// ── I-7: Telegram failure does not erase or roll back a committed order ──────

describe("I-7: telegram failure isolation", () => {
  test("delivery transport fails 3× → order stays committed, delivery logged FAILED, token never in payload", async () => {
    // switch the stub to a failing transport
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED (test stub)");
    }) as unknown as typeof fetch;

    setCookie(null);
    const res = await checkout({ email: "tg-isolation@test.dev" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orderNumber: string };
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: body.orderNumber } });
    expect(order.status).toBe("PENDING_PAYMENT"); // committed and untouched

    // wait for the detached delivery to exhaust retries (1.5s + 3s backoff)
    let delivery: { status: string; attempts: number; payload: string; target: string | null } | null = null;
    for (let i = 0; i < 40; i++) {
      const row = await db.notificationDelivery.findFirst({
        where: { orderId: order.id, event: "ORDER_CREATED" },
      });
      if (row && row.status === "FAILED") {
        delivery = row;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    expect(delivery).not.toBeNull();
    expect(delivery!.attempts).toBe(3);
    expect(delivery!.status).toBe("FAILED");
    expect(delivery!.payload).not.toContain("222:DB-TOKEN");
    expect(delivery!.target).not.toBe("42"); // masked chat id, never the raw value

    // restore the "network"
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;
  }, 30_000);

  test("webmaster telegram config endpoint returns masked values only", async () => {
    setCookie(OM_COOKIE); // notifications capability
    const res = (await wmTelegramRoute.GET()) as Response;
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("222:DB-TOKEN");
    expect(text.toLowerCase()).toContain("mask");
  });
});

// ── I-8: database failure produces a controlled error without leaking secrets ─

describe("I-8: controlled error funnel", () => {
  test("generic errors → 500 with fixed message, no stack/URL/credentials leaked", async () => {
    const leaky = new Error("write EPIPE postgres://admin:s3cret@db.internal:5432/prod");
    const res = handleError(leaky);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Something went wrong. Please try again.");
    expect(body.error).not.toContain("s3cret");
    expect(JSON.stringify(body)).not.toContain("postgres");
  });

  test("connection-level failures map to actionable messages without leaking credentials", async () => {
    // ECONNREFUSED carrying a credentials-laden URL must never echo it back.
    const leaky = new Error("connect ECONNREFUSED postgres://admin:s3cret@db.internal:5432/prod");
    const res = handleError(leaky) as Response;
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("unreachable");
    expect(body.error).not.toContain("s3cret");

    // PgBouncer prepared-statement collision (Neon pooled URL without pgbouncer=true)
    const pooled = new Error('prepared statement "s1" already exists');
    const pooledBody = (await (handleError(pooled) as Response).json()) as { error: string };
    expect(pooledBody.error).toContain("pgbouncer=true");

    // Missing tables (schema push never ran on this database)
    const p2021 = new PrismaNS.PrismaClientKnownRequestError("table missing", {
      code: "P2021",
      clientVersion: "test",
    });
    const p2021Body = (await (handleError(p2021) as Response).json()) as { error: string };
    expect(p2021Body.error).toContain("tables are missing");

    // Missing/invalid env var at runtime (P1012) — previously the generic
    // "Something went wrong" fallback; must now be actionable.
    const p1012 = new Error("Environment variable `DATABASE_URL` was not found");
    const p1012Body = (await (handleError(p1012) as Response).json()) as { error: string };
    expect(p1012Body.error).toContain("P1012");
    expect(p1012Body.error).toContain("DATABASE_URL");

    const invalidUrl = new Error("Error validating datasource `db`: the URL must start with the protocol `postgres`");
    const invalidUrlBody = (await (handleError(invalidUrl) as Response).json()) as { error: string };
    expect(invalidUrlBody.error).toContain("P1012");
  });

  test("health probe reports db/schema/seed as booleans only — no internals", async () => {
    const res = (await healthRoute.GET()) as Response;
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.db).toBe("reachable");
    expect(body.schema).toBe(true);
    expect(body.seeded).toBe(true); // fixtures written in beforeAll
    expect(text).not.toContain("postgresql");
    expect(text).not.toContain("DATABASE_URL");
    expect(text).not.toContain("file:");
  });

  test("Prisma P2002 → 409, P2025 → 404, ZodError → 422", async () => {
    const p2002 = new PrismaNS.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" });
    expect((handleError(p2002) as Response).status).toBe(409);
    const p2025 = new PrismaNS.PrismaClientKnownRequestError("missing", { code: "P2025", clientVersion: "test" });
    expect((handleError(p2025) as Response).status).toBe(404);

    const { z } = await import("zod");
    try {
      z.object({ a: z.string() }).parse({});
    } catch (e) {
      expect((handleError(e) as Response).status).toBe(422);
    }
  });

  test("malformed JSON body → controlled 500, no parser internals exposed", async () => {
    const res = (await ordersRoute.POST(
      req("/api/orders", { method: "POST", body: "{this is not json" })
    )) as Response;
    expect([400, 500]).toContain(res.status);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("SyntaxError");
    expect(text).not.toContain("at ");
  });
});

// ── I-10: public responses do not expose private data ────────────────────────

describe("I-10: data exposure", () => {
  test("webmaster customers listing never includes password hashes", async () => {
    setCookie(OM_COOKIE); // customers capability
    const res = (await wmCustomersRoute.GET(
      req("/api/webmaster/customers")
    )) as Response;
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("passwordHash");
    expect(text).not.toMatch(/\$2[aby]\$/);
  });

  test("anonymous webmaster access → 401 (customers)", async () => {
    setCookie(null);
    const res = (await wmCustomersRoute.GET(
      req("/api/webmaster/customers")
    )) as Response;
    expect(res.status).toBe(401);
  });

  test("track endpoint does not reveal whether an order number exists (uniform 404)", async () => {
    const nonexistent = (await trackRoute.POST(
      req("/api/track", {
        method: "POST",
        body: JSON.stringify({ orderNumber: "ME-99-XXXXXX", email: "someone@test.dev" }),
      })
    )) as Response;
    expect(nonexistent.status).toBe(404);
    const body = (await nonexistent.json()) as { error: string };
    // uniform message whether the order number OR the email is wrong
    expect(body.error).toBe("Order not found. Check your order number and email.");
  });
});

// ── I-11: bootstrap seed invariants (seed v2 — idempotent, self-healing) ─────
// Two perspectives, matching the S-01 security rule (demo users are created
// ONLY on an empty users table):
//  1. in-process tests run against the SHARED fixture DB (users already exist
//     from earlier describes) → the seed must fill the catalog but create
//     ZERO users and NEVER resurrect documented demo credentials;
//  2. a CLI subprocess test seeds a FRESH empty DB end-to-end (the exact
//     contract `scripts/prisma-deploy-db.cjs` relies on at deploy time).

describe("I-11: bootstrap seed", () => {
  let seed: typeof import("../prisma/seed");

  beforeAll(async () => {
    seed = await import("../prisma/seed");
  });

  test("runSeed() fills the catalog exactly once — and NEVER creates demo users on a populated DB (S-01)", async () => {
    // The shared fixture DB already holds users (checkout fixtures above).
    // Under S-01 the seed must fill the catalog while creating zero users:
    // a redeploy must never resurrect `owner@maisonelan.dev` with its
    // publicly documented password on a store that already has an owner.
    const first = await seed.runSeed();
    expect(first.created.users).toBe(0);
    expect(await db.user.findUnique({ where: { email: "owner@maisonelan.dev" } })).toBeNull();
    expect(await db.user.findUnique({ where: { email: "orders@maisonelan.dev" } })).toBeNull();
    expect(first.created.products).toBe(14);
    expect(first.created.categories).toBe(5);
    // counts include pre-existing checkout fixtures, so seed data is a floor
    expect(first.counts.products).toBeGreaterThanOrEqual(14);
    expect(first.counts.productVariants).toBeGreaterThanOrEqual(25);
    expect(first.counts.contentPages).toBe(7);
    expect(first.counts.shippingRates).toBeGreaterThanOrEqual(4);

    // second pass: every seed row already exists → nothing created, nothing repaired
    const second = await seed.runSeed();
    for (const n of Object.values(second.created)) expect(n).toBe(0);
    expect(second.repaired).toHaveLength(0);
  });

  test("ensure mode never overwrites admin-owned rows; force mode repairs seed rows", async () => {
    // simulate an admin edit on a seeded product
    const product = await db.product.findUnique({ where: { slug: "elan-structured-tote" } });
    expect(product).toBeTruthy();
    await db.product.update({ where: { id: product!.id }, data: { priceCents: 12345, isFeatured: false } });

    await seed.runSeed(); // ensure mode
    const afterEnsure = await db.product.findUnique({ where: { slug: "elan-structured-tote" } });
    expect(afterEnsure!.priceCents).toBe(12345); // admin edit survived
    expect(afterEnsure!.isFeatured).toBe(false);

    await seed.runSeed({ force: true }); // explicit repair of seed-owned rows
    const afterForce = await db.product.findUnique({ where: { slug: "elan-structured-tote" } });
    expect(afterForce!.priceCents).toBe(4290000 * 100); // canonical again
  });

  test("broken bcrypt hashes on demo accounts are self-healed (external SQL dump damage)", async () => {
    // Simulate an external SQL dump that wrote the demo owner email with a
    // garbage hash. The account EXISTS, so the S-01 creation ban does not
    // apply — but the invalid-hash self-heal must still restore login.
    await db.user.create({
      data: {
        email: "owner@maisonelan.dev",
        passwordHash: "definitely-not-a-bcrypt-hash-from-a-sql-dump",
        name: "Dump Owner",
        role: "OWNER",
      },
    });

    // plain ensure mode repairs it — a redeploy must always restore login
    const summary = await seed.runSeed();
    expect(summary.repaired.some((r) => r.includes("owner@maisonelan.dev"))).toBe(true);

    const healed = await db.user.findUnique({ where: { email: "owner@maisonelan.dev" } });
    expect(healed!.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  test("seed never deletes rows that are not part of the seed set", async () => {
    const outsider = await db.user.create({
      data: {
        email: "human-owner@example.com",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
        name: "Real Owner",
        role: "OWNER",
      },
    });
    const customProduct = await db.product.create({
      data: { name: "Admin Special", slug: "admin-special", description: "admin-created", priceCents: 1, skuBase: "ADM-1" },
    });

    await seed.runSeed({ force: true });

    expect(await db.user.findUnique({ where: { id: outsider.id } })).toBeTruthy();
    expect(await db.product.findUnique({ where: { id: customProduct.id } })).toBeTruthy();
  });

  test("verifyDb(): healthy after seed; flags an empty catalog; seed self-repairs it", async () => {
    const healthy = await seed.verifyDb();
    expect(healthy.ok).toBe(true);
    expect(healthy.errors).toHaveLength(0);

    // reproduce the empty-catalog incident: catalog rows vanish (bad manual SQL)
    await db.product.deleteMany({});
    const broken = await seed.verifyDb();
    expect(broken.ok).toBe(false);
    expect(broken.errors.join(" ")).toContain("products");

    // one redeploy (ensure seed) recreates every missing row
    await seed.runSeed();
    const healed = await seed.verifyDb();
    expect(healed.ok).toBe(true);
  });

  test("fresh-install path (CLI subprocess): empty DB gets the 3 demo users; re-run is a no-op", async () => {
    // The S-01 inverse, proven end-to-end: on an EMPTY users table the seed
    // creates the 3 documented demo accounts (fresh demo install), and a
    // second seed run is inert. Runs in a subprocess with its own throwaway
    // SQLite DB — the exact contract prisma-deploy-db.cjs exercises on deploy.
    const freshDb = join("/tmp", `maison-elan-fresh-${randomBytes(3).toString("hex")}.db`);
    const env = { ...process.env, DATABASE_URL: `file:${freshDb}` };
    try {
      execSync("bunx prisma db push --skip-generate", { cwd: "/home/z/my-project", env, stdio: "pipe" });
      const first = execSync("bun prisma/seed.ts", { cwd: "/home/z/my-project", env, stdio: "pipe", encoding: "utf8" });
      expect(first).toContain("Created");
      expect(first).toContain("3 users");

      const second = execSync("bun prisma/seed.ts", { cwd: "/home/z/my-project", env, stdio: "pipe", encoding: "utf8" });
      expect(second).toContain("Nothing to do");

      // --verify passes on the freshly seeded store
      execSync("bun prisma/seed.ts --verify", { cwd: "/home/z/my-project", env, stdio: "pipe" });
    } finally {
      rmSync(freshDb, { force: true });
      rmSync(`${freshDb}-journal`, { force: true });
    }
  }, 30000);
});
