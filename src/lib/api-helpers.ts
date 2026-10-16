// Shared helpers for route handlers: uniform JSON responses + error funnel.

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { CheckoutError, TransitionError } from "@/lib/orders";
import { Prisma } from "@prisma/client";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data as object, { status: init ?? 200 });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail(
      first ? `${first.path.join(".") || "Input"}: ${first.message}` : "Invalid input.",
      422
    );
  }
  if (err instanceof AuthError) return fail(err.message, err.status);
  if (err instanceof CheckoutError) return fail(err.message, err.status);
  if (err instanceof TransitionError) return fail(err.message, err.status);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return fail("A record with this unique value already exists.", 409);
    if (err.code === "P2025") return fail("Record not found.", 404);
    if (err.code === "P2021")
      return fail("Database tables are missing. Redeploy so the build can sync the schema.", 500);
    if (err.code === "P2022")
      return fail("Database schema is out of date. Redeploy to sync the schema.", 500);
  }

  // Connection-level failures surface as PrismaClientInitializationError or raw
  // driver errors — the codes appear in the message text. Mapping them to
  // actionable messages (still no secrets) makes deployment issues diagnosable
  // from the UI instead of only from server logs.
  const rawMessage = err instanceof Error ? err.message : String(err ?? "");
  if (/^P1012$|Environment variable `?[A-Z_]+`? was not found|Error validating datasource/i.test(rawMessage))
    return fail(
      "Database configuration error (P1012). The database environment variable is missing or invalid — check DATABASE_URL (and DIRECT_DATABASE_URL for CLI) in your deployment settings.",
      500
    );

  if (/P1001|Can't reach database server|ECONNREFUSED|ETIMEDOUT/i.test(rawMessage))
    return fail(
      "Database is unreachable. Check DATABASE_URL and that the Neon compute is active.",
      500
    );
  if (/Timed out fetching a new connection from the connection pool|P2024/i.test(rawMessage))
    return fail(
      "Database connection pool is exhausted. Check the pooled DATABASE_URL (?pgbouncer=true, ?connection_limit).",
      500
    );
  if (/prepared statement .* already exists/i.test(rawMessage))
    return fail(
      "Database pooler conflict. Add ?pgbouncer=true to the pooled DATABASE_URL and redeploy.",
      500
    );

  console.error("[api] unhandled error:", err);
  // never leak internals to the client
  return fail("Something went wrong. Please try again.", 500);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

export function appUrl(): string {
  // APP_URL is the canonical name (see .env.example / docs/DEPLOYMENT-VERCEL.md).
  // NEXT_PUBLIC_* variants are accepted as fallbacks for convenience on Vercel.
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  // normalize: no trailing slash, no stray whitespace (deep links stay clean)
  return raw.trim().replace(/\/+$/, "");
}
