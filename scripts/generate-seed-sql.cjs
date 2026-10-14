// MAISON ÉLAN — generates prisma/seed.sql: the demo seed as plain SQL for the
// Neon/PostgreSQL SQL Editor (no CLI or Prisma needed at apply-time).
//
// How it works (all inside a THROWAWAY SQLite database — your own DB is never
// touched):
//   1. prisma db push into os.tmpdir()/maison-elan-seed-src.db
//   2. run prisma/seed.ts against it (the REAL seed — hashes are genuine bcrypt)
//   3. dump every populated table to INSERT statements, Postgres-flavoured:
//      quoted identifiers, TRUE/FALSE booleans, timestamp literals,
//      ''-escaped strings, ON CONFLICT DO NOTHING (idempotent), BEGIN/COMMIT.
//
// Requires the default SQLite Prisma Client (bun run db:generate) — run this
// BEFORE switching to the PostgreSQL client (db:generate:pg).
//
// Usage:  bun run seed:sql        (or: node scripts/generate-seed-sql.cjs)

/* eslint-disable @typescript-eslint/no-require-imports -- utility CLI: CommonJS, run directly via node/bun */

const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = process.cwd();
const SRC_DB = path.join(os.tmpdir(), "maison-elan-seed-src.db");
const LOG = "[seed-sql]";

// The SQL client must be SQLite for the throwaway DB — set BEFORE creating PrismaClient.
process.env.DATABASE_URL = `file:${SRC_DB}`;

// ── helpers ──────────────────────────────────────────────────────────────────
function runFirst(commands, label) {
  for (const cmd of commands) {
    try {
      execSync(cmd, { stdio: "inherit", cwd: root, timeout: 300000 });
      return true;
    } catch {
      // try next runner
    }
  }
  console.error(`${LOG} ${label} — all runners failed.`);
  return false;
}

function sqlValue(v, type) {
  if (v === null || v === undefined) return "NULL";
  if (type.startsWith("BOOLEAN")) return v ? "TRUE" : "FALSE";
  if (type.startsWith("DATETIME")) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new Error(`Bad datetime value: ${v}`);
    return `'${d.toISOString().slice(0, 23).replace("T", " ")}'`;
  }
  if (type.startsWith("INT")) return String(Number(v));
  return `'${String(v).replace(/'/g, "''")}'`; // TEXT + JSON strings (also PG-safe: backslashes stay literal)
}

// FK-safe dump order (children after parents).
const TABLES = [
  "User", "Session", "Address", "StoreSetting",
  "Category", "Product", "ProductImage", "ProductVariant", "ProductCategory",
  "Order", "OrderItem", "OrderStatusHistory", "PaymentRecord",
  "Courier", "ShippingRate", "Shipment", "ShipmentStatusHistory",
  "Banner", "ContentPage", "FaqEntry",
  "WishlistItem", "NewsletterSubscriber", "NotificationDelivery", "AdminAuditLog", "PasswordResetToken",
];

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.rmSync(SRC_DB, { force: true });

  console.log(`${LOG} Step 1/3 — creating throwaway schema (${SRC_DB})…`);
  if (!runFirst(
    [
      "node_modules/.bin/prisma db push --schema prisma/schema.prisma --skip-generate",
      "npx prisma db push --schema prisma/schema.prisma --skip-generate",
      "bunx prisma db push --schema prisma/schema.prisma --skip-generate",
    ],
    "prisma db push",
  )) process.exit(1);

  console.log(`${LOG} Step 2/3 — running the official seed (prisma/seed.ts)…`);
  if (!runFirst(
    ["bun prisma/seed.ts", "npx tsx prisma/seed.ts"],
    "seed",
  )) process.exit(1);

  console.log(`${LOG} Step 3/3 — dumping rows to prisma/seed.sql…`);
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();

  const out = [];
  out.push(`-- ═════════════════════════════════════════════════════════════════════════`);
  out.push(`-- MAISON ÉLAN — PostgreSQL seed for the Neon SQL Editor`);
  out.push(`-- ═════════════════════════════════════════════════════════════════════════`);
  out.push(`-- Generated from prisma/seed.ts by scripts/generate-seed-sql.cjs (v0.2.2).`);
  out.push(`-- Regenerate after changing the seed:  bun run seed:sql`);
  out.push(`--`);
  out.push(`-- HOW TO USE — Neon Console → SQL Editor → paste this file → Run.`);
  out.push(`-- Every INSERT uses ON CONFLICT DO NOTHING → safe to run more than once.`);
  out.push(`--`);
  out.push(`-- ACCOUNTS (dev-only passwords — CHANGE THEM right after the first login):`);
  out.push(`--   owner@maisonelan.dev  / Maison2025!   (OWNER)`);
  out.push(`--   orders@maisonelan.dev / Staff2025!    (ORDER_MANAGER)`);
  out.push(`--   customer@example.com  / Customer2025! (CUSTOMER)`);
  out.push(`--`);
  out.push(`-- Login fails for EVERY password? The stored hash is not real bcrypt`);
  out.push(`-- (valid = exactly 60 chars, random ./A-Za-z0-9). Fix any account:`);
  out.push(`--   bun run hash:password "NewPassword123!"`);
  out.push(`--   UPDATE "User" SET "passwordHash" = '<hash>' WHERE email = '…';`);
  out.push(`--`);
  out.push(`-- OPTIONAL RESET — uncomment the block below to wipe demo/content data`);
  out.push(`-- before seeding (CASCADE also removes orders/sessions/wishlists that`);
  out.push(`-- belong to the seeded users). Keep commented on a production database!`);
  out.push(`-- BEGIN;`);
  out.push(`-- TRUNCATE "ProductImage", "ProductVariant", "ProductCategory", "Product",`);
  out.push(`--          "Category", "ShippingRate", "Courier", "Banner", "ContentPage",`);
  out.push(`--          "FaqEntry", "Address", "Session", "WishlistItem", "OrderItem",`);
  out.push(`--          "Order", "StoreSetting", "User" CASCADE;`);
  out.push(`-- COMMIT;`);
  out.push(``);
  out.push(`BEGIN;`);

  const summary = [];
  try {
    for (const table of TABLES) {
      const cols = await db.$queryRawUnsafe(`PRAGMA table_info('${table}')`);
      if (cols.length === 0) continue; // table missing (older schema) — skip
      const rows = await db.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY rowid`);
      if (rows.length === 0) continue; // nothing seeded — skip
      const colList = cols.map((c) => `"${c.name}"`).join(", ");
      out.push(``);
      out.push(`-- ── ${table} (${rows.length} rows)`);
      for (const row of rows) {
        const vals = cols.map((c) => sqlValue(row[c.name], c.type || "TEXT")).join(", ");
        out.push(`INSERT INTO "${table}" (${colList}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
      }
      summary.push(`${table}: ${rows.length}`);
    }
  } finally {
    await db.$disconnect();
  }

  out.push(``);
  out.push(`COMMIT;`);
  out.push(``);
  out.push(`-- Done. Sign in as owner@maisonelan.dev / Maison2025!, then change the password.`);
  out.push(``);

  const target = path.join(root, "prisma", "seed.sql");
  fs.writeFileSync(target, out.join("\n"), "utf8");
  console.log(`${LOG} wrote ${target} (${(fs.statSync(target).size / 1024).toFixed(1)} KB)`);
  console.log(`${LOG} seeded tables: ${summary.join(" · ")}`);
}

main()
  .then(() => {
    fs.rmSync(SRC_DB, { force: true });
    process.exit(0);
  })
  .catch((e) => {
    console.error(`${LOG} FAILED:`, e);
    console.error(`${LOG} Note: this tool needs the default SQLite Prisma Client — run "bun run db:generate" first if you switched to PostgreSQL.`);
    process.exit(1);
  });
