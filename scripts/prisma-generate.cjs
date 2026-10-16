// MAISON ÉLAN — environment-aware Prisma client generator (v2).
// Runs on `postinstall` and before `build` (see package.json).
//
// Picks the schema that matches the target environment so the generated
// Prisma Client ALWAYS matches DATABASE_URL — this is what prevents the
// classic Vercel crash:
//   "Error validating datasource `db`: the URL must start with the protocol `file:`"
// (that error = a SQLite client running against a postgres:// URL).
//
// Selection rules (first match wins):
//   1. VERCEL=1                      → PostgreSQL schema (Neon)  — Vercel has no persistent disk
//   2. DATABASE_URL starts postgres… → PostgreSQL schema (Neon / any PG) — env var OR .env file
//   3. otherwise                     → SQLite schema (local / self-hosted VPS)
//
// v2 — FAIL LOUD (anti-silent):
//   After a runner reports success we VERIFY that the client was actually
//   generated (node_modules/.prisma/client/index.js). If every runner fails —
//   or "succeeds" without producing a client — the script exits 1 with exact
//   remediation steps. A missing Prisma Client crashes at runtime with a
//   misleading error (import failure / "Something went wrong"), so an install
//   that quietly skipped generation is the worst possible outcome. This mirrors
//   the v1→v2 lesson from the seed chain: silent success is a bug factory.
//
// Escape hatch: PRISMA_GENERATE_SOFT_FAIL=1 → print the warning, exit 0
// (for exotic environments where a hard failure would block unrelated work).

/* eslint-disable @typescript-eslint/no-require-imports -- build-time helper: must stay CommonJS, runs under node/bun before any bundling */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const TAG = "[prisma-generate]";
const GENERATED_CLIENT = path.join(root, "node_modules", ".prisma", "client", "index.js");

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

const url = databaseUrl();
const usePostgres = process.env.VERCEL === "1" || url.startsWith("postgres");
const schema = usePostgres ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma";

console.log(`${TAG} VERCEL=${process.env.VERCEL ?? "unset"} DATABASE_URL=${url ? url.split("@").pop() || "(set)" : "(unset)"}`);
console.log(`${TAG} Generating Prisma Client from ${schema} …`);

// [cmd, …args] arrays — no shell, safe for paths with spaces/special chars.
const candidates = [
  ["node_modules/.bin/prisma", "generate", "--schema", schema],
  ["npx", "prisma", "generate", "--schema", schema],
  ["bunx", "prisma", "generate", "--schema", schema],
];

let lastError = "";
for (const [cmd, ...args] of candidates) {
  try {
    execFileSync(cmd, args, { stdio: "inherit", cwd: root, timeout: 300000 });
    if (fs.existsSync(GENERATED_CLIENT)) {
      console.log(`${TAG} done (${cmd}) — client verified at node_modules/.prisma/client.`);
      process.exit(0);
    }
    lastError = `${cmd} exited 0 but node_modules/.prisma/client/index.js was not generated.`;
    console.warn(`${TAG} ⚠ ${lastError} Trying next runner…`);
  } catch (err) {
    const e = err || {};
    lastError = `${cmd} failed (${e.status ?? e.code ?? "unknown"}).`;
    console.warn(`${TAG} ${lastError} Trying next runner…`);
  }
}

// Every runner failed (or produced no client) — fail LOUD.
console.error(`${TAG} ─────────────────────────────────────────────────────────────`);
console.error(`${TAG} FAILED: Prisma Client could not be generated.`);
console.error(`${TAG} Last error: ${lastError}`);
console.error(`${TAG}`);
console.error(`${TAG} Without the generated client the app crashes at runtime with`);
console.error(`${TAG} misleading errors (missing module / "Something went wrong").`);
console.error(`${TAG} Fix options:`);
console.error(`${TAG}   1. Reinstall dependencies so the Prisma engines are present:`);
console.error(`${TAG}        npm install      (or: bun install)`);
console.error(`${TAG}      If npm warns "install scripts not yet covered by allowScripts",`);
console.error(`${TAG}      approve them — see docs/INSTALLATION.md §npm install-scripts.`);
console.error(`${TAG}   2. Then generate manually and re-run the build:`);
console.error(`${TAG}        npm run db:generate        (SQLite)`);
console.error(`${TAG}        npm run db:generate:pg     (PostgreSQL / Neon)`);
console.error(`${TAG} Escape hatch: PRISMA_GENERATE_SOFT_FAIL=1 continues with exit 0.`);
console.error(`${TAG} ─────────────────────────────────────────────────────────────`);
if (process.env.PRISMA_GENERATE_SOFT_FAIL === "1") {
  console.warn(`${TAG} PRISMA_GENERATE_SOFT_FAIL=1 → continuing with exit 0 (NOT verified).`);
  process.exit(0);
}
process.exit(1);
