// MAISON ÉLAN — environment-aware Prisma client generator.
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
// The script never hard-fails the install/build: if the CLI cannot be found
// it prints a warning and exits 0 (deploy platforms still complete; the
// warning surfaces in build logs).

/* eslint-disable @typescript-eslint/no-require-imports -- build-time helper: must stay CommonJS, runs under node/bun before any bundling */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();

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

console.log(`[prisma-generate] VERCEL=${process.env.VERCEL ?? "unset"} DATABASE_URL=${url ? url.split("@").pop() || "(set)" : "(unset)"}`);
console.log(`[prisma-generate] Generating Prisma Client from ${schema} …`);

const candidates = [
  "node_modules/.bin/prisma", // fastest — local CLI binary (node shebang)
  "npx prisma",               // npm-based environments
  "bunx prisma",              // bun-only machines without node
];

for (const cmd of candidates) {
  try {
    execSync(`${cmd} generate --schema ${schema}`, { stdio: "inherit", cwd: root });
    console.log(`[prisma-generate] done (${cmd})`);
    process.exit(0);
  } catch {
    // try the next runner
  }
}

console.warn(
  `[prisma-generate] Could not run prisma generate automatically. ` +
    `Run "bun run db:generate" (SQLite) or "bun run db:generate:pg" (PostgreSQL/Neon) manually before building.`,
);
process.exit(0);
