// MAISON ÉLAN — runner-agnostic seed launcher.
// Runs prisma/seed.ts with whatever runner the machine actually has, in order:
//   bun → npx --yes tsx → bunx tsx
// This exists because `db:seed` used to hard-code `bun`, which npm-only
// buyers don't have — their `npm run db:seed` failed with "bun: command not
// found" and looked identical to a broken database.
//
// Usage (argv is passed through to prisma/seed.ts):
//   node scripts/seed-run.cjs            seed (ensure mode, honors SEED_FORCE)
//   node scripts/seed-run.cjs --force    force-repair seed rows
//   node scripts/seed-run.cjs --verify   read-only row counts
// Fails LOUD: if no runner can execute the seed, exit 1 with remediation.

/* eslint-disable @typescript-eslint/no-require-imports -- build-time helper: must stay CommonJS, runs under node/bun before any bundling */

const { execFileSync } = require("child_process");
const path = require("path");

const root = process.cwd();
const TAG = "[seed-run]";
const SEED = path.join("prisma", "seed.ts");
const argv = process.argv.slice(2);

const candidates = [
  ["bun", [SEED, ...argv]],
  ["npx", ["--yes", "tsx", SEED, ...argv]],
  ["bunx", ["tsx", SEED, ...argv]],
];

let lastError = "";
for (const [cmd, args] of candidates) {
  try {
    const out = execFileSync(cmd, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      timeout: 300000,
      env: process.env,
    });
    if (out && out.trim()) console.log(out.trimEnd());
    process.exit(0);
  } catch (err) {
    const e = err || {};
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    const status = typeof e.status === "number" ? e.status : null;
    const missing =
      e.code === "ENOENT" ||
      status === 127 ||
      /command not found|not found:/i.test(output) ||
      /ENOENT/i.test(e.message ?? "");
    if (missing) {
      console.log(`${TAG} runner not available (${cmd}) — trying next.`);
      lastError = `${cmd} not available`;
      continue;
    }
    // The seed itself failed — print everything and exit with its code.
    if (output.trim()) console.error(output.trimEnd());
    console.error(`${TAG} seed FAILED via ${cmd} (exit ${status ?? "?"}).`);
    process.exit(status ?? 1);
  }
}

console.error(`${TAG} ─────────────────────────────────────────────────────────────`);
console.error(`${TAG} FAILED: no runner could execute prisma/seed.ts (last: ${lastError}).`);
console.error(`${TAG} Install one of: bun, or tsx via npm (npx tsx is fetched automatically).`);
console.error(`${TAG} Check your network if npx could not download tsx, then re-run:`);
console.error(`${TAG}   npm run db:seed`);
console.error(`${TAG} ─────────────────────────────────────────────────────────────`);
process.exit(1);
