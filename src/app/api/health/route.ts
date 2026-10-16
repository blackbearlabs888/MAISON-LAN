// Public deployment health probe — one request tells the operator apart:
//   db unreachable  → DATABASE_URL wrong / Neon compute suspended / pooler issue
//   schema missing  → the build's `prisma db push` never ran on this database
//   seeded=false    → tables exist but hold no users (seed skipped or failed)
//
// Safe by construction: the response contains only booleans + a timestamp —
// never counts, identifiers, connection strings or error internals. Used by
// docs/DEPLOYMENT_RUNBOOK.md §4 smoke tests and docs/TROUBLESHOOTING.md.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const time = new Date().toISOString();

  // 1. Reachability — SELECT 1 works on SQLite and PostgreSQL alike.
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json(
      { status: "unhealthy", db: "unreachable", schema: false, seeded: false, time },
      { status: 503 }
    );
  }

  // 2. Schema presence — a query against an app-owned table; missing tables
  //    raise Prisma error P2021 which lands in the catch below.
  // 3. Seed state — boolean only, no counts are exposed.
  try {
    await db.storeSetting.findUnique({ where: { id: "global" } });
    const seeded = (await db.user.count()) > 0;
    return NextResponse.json({ status: "ok", db: "reachable", schema: true, seeded, time });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", db: "reachable", schema: false, seeded: false, time },
      { status: 503 }
    );
  }
}
