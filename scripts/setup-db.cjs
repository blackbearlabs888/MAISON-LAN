// MAISON ÉLAN — one-command local database setup.
//   npm run setup       (or: bun run setup)
//   = generate client → create tables (prisma db push) → seed → verify counts
//
// This exists because nothing between `npm install` and the running app ever
// created tables or seeded data BY DESIGN — auto-DDL inside a lifecycle hook
// would fire against whatever DATABASE_URL happens to be set (CI, Vercel,
// a production database) and that is never acceptable. So local first-run
// provisioning is an explicit command: this one.
//
// SAFETY RULES:
//   • VERCEL=1 or a postgres:// DATABASE_URL → REFUSES to run (print pointer).
//     Remote provisioning belongs to `vercel-build` (scripts/prisma-deploy-db.cjs),
//     which runs migrations + seed with drift checks at deploy time.
//   • Local SQLite only. Uses `prisma db push` WITHOUT --accept-data-loss, so a
//     destructive change to an existing database prompts instead of destroying.
//   • Seed runs in ensure mode: fills missing rows, never deletes, never
//     overwrites admin-owned rows (see prisma/seed.ts v2 semantics).

/* eslint-disable @typescript-eslint/no-require-imports -- build-time helper: must stay CommonJS, runs under node/bun before any bundling */

const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const TAG = "[setup-db]";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envFile = fs.readFileSync(path.join(root, ".env"), "utf8");
    const m = envFile.match(/^DATABASE_URL\s*=\s*"?([^"\r\n#]+)"?/m);
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

function run(cmd, args, { inherit = true } = {}) {
  execFileSync(cmd, args, {
    cwd: root,
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: 600000,
    env: process.env,
  });
}

const url = databaseUrl();

// ── guard: never touch a remote/shared database from a local setup command ──
if (process.env.VERCEL === "1") {
  console.log(`${TAG} VERCEL=1 → nothing to do. On Vercel the build provisions the database`);
  console.log(`${TAG} automatically (vercel-build → scripts/prisma-deploy-db.cjs: migrate deploy + seed + verify).`);
  process.exit(0);
}
if (url.startsWith("postgres")) {
  console.log(`${TAG} DATABASE_URL points at PostgreSQL (${url.split("@").pop() || "set"}) — refusing to auto-run setup against a remote database.`);
  console.log(`${TAG} On Vercel this is handled by the build. Locally, provision explicitly:`);
  console.log(`${TAG}   npm run db:generate:pg`);
  console.log(`${TAG}   npm run db:push:pg        # creates/updates tables (accepts data loss — read first)`);
  console.log(`${TAG}   npm run db:seed:pg        # seeds demo data (ensure mode)`);
  process.exit(0);
}

console.log(`${TAG} Local SQLite setup — 4 steps: generate → tables → seed → verify.`);
console.log(`${TAG} ── Step 1/4: Prisma Client ───────────────────────────────────`);
try {
  run("node", [path.join("scripts", "prisma-generate.cjs")]);
} catch (err) {
  console.error(`${TAG} Prisma Client generation failed (exit ${err.status ?? "?"}). Aborting — see output above.`);
  process.exit(1);
}

console.log(`${TAG} ── Step 2/4: create tables (prisma db push) ──────────────────`);
const prismaBin = path.join("node_modules", ".bin", "prisma");
try {
  // No --accept-data-loss: destructive changes prompt instead of destroying.
  run(prismaBin, ["db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"]);
} catch (err) {
  console.error(`${TAG} prisma db push FAILED (exit ${err.status ?? "?"}).`);
  console.error(`${TAG} If the database has drifted, inspect it first:`);
  console.error(`${TAG}   npm run db:migrate:status   (Postgres)  ·  or delete the SQLite file for a fresh start`);
  process.exit(1);
}

console.log(`${TAG} ── Step 3/4: seed demo data (ensure mode) ────────────────────`);
try {
  run("node", [path.join("scripts", "seed-run.cjs")]);
} catch (err) {
  console.error(`${TAG} seed FAILED (exit ${err.status ?? "?"}). Aborting — see output above.`);
  console.error(`${TAG} The schema exists now, so the failure is in the seed data/connection.`);
  process.exit(1);
}

console.log(`${TAG} ── Step 4/4: verify row counts ───────────────────────────────`);
try {
  run("node", [path.join("scripts", "seed-run.cjs"), "--verify"]);
} catch {
  // verify already printed its errors; treat as non-fatal proof step here
  console.warn(`${TAG} ⚠ verification reported problems above — check them before starting the app.`);
  process.exit(1);
}

console.log(`${TAG} ─────────────────────────────────────────────────────────────`);
console.log(`${TAG} ✅ Setup complete. Start the app with: npm run dev (or bun run dev)`);
console.log(`${TAG} Demo credentials (dev-only, change before real use):`);
console.log(`${TAG}   Owner:    owner@maisonelan.dev / Maison2025!`);
console.log(`${TAG}   Staff:    orders@maisonelan.dev / Staff2025!`);
console.log(`${TAG}   Customer: customer@example.com / Customer2025!`);
console.log(`${TAG} ─────────────────────────────────────────────────────────────`);
