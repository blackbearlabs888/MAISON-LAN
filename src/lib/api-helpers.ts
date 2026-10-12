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
  }

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
  return process.env.APP_URL || "http://localhost:3000";
}
