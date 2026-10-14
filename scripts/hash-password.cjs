// MAISON ÉLAN — password hash generator (admin utility).
// Produces a REAL bcrypt hash for inserting/updating a `User.passwordHash`
// directly in the database (e.g. via the Neon SQL Editor).
//
// Usage:
//   bun run hash:password "YourPasswordHere"
//   node scripts/hash-password.cjs "YourPasswordHere"
//
// Why this exists: manually inserted users often carry placeholder/example
// hashes (wrong length or repeating characters). Those never validate —
// bcrypt.compare() fails for EVERY password ("Invalid email or password").
// A valid hash is exactly 60 chars: `$2a$` or `$2b$` + cost `10$` + 50 chars
// of random base64 (alphabet ./A-Za-z0-9). This tool guarantees that.

/* eslint-disable @typescript-eslint/no-require-imports -- utility CLI: CommonJS, run directly via node/bun */

const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error('Usage: bun run hash:password "YourPasswordHere"');
  console.error('       node scripts/hash-password.cjs "YourPasswordHere"');
  console.error("Tip: run it in a private shell — command lines can be logged.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password too short — use at least 8 characters.");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

// Self-check: the printed hash MUST verify against the input.
if (!bcrypt.compareSync(password, hash) || hash.length !== 60) {
  console.error("SELF-CHECK FAILED — hash invalid, do NOT use it.");
  process.exit(1);
}

// Hash on stdout (pipe-able); guidance on stderr.
console.log(hash);
console.error(`✔ valid bcrypt hash — 60 chars, cost 10, self-check passed`);
console.error("");
console.error(`Apply it (Neon SQL Editor / psql):`);
console.error(
  `  UPDATE "User" SET "passwordHash" = '<hash above>' WHERE email = 'you@example.com';`,
);
