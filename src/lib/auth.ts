// Authentication & authorization core (DECISIONS D-03).
// bcrypt password hashing + opaque DB-backed session tokens in HttpOnly cookies.
// EVERY protected API route and server component must call these helpers —
// hiding UI elements is never treated as authorization.

import "server-only";
import { cookies, headers } from "next/headers";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "me_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Cookie policy:
 * - SameSite=None; Secure is REQUIRED when the app is embedded in a cross-site
 *   iframe (e.g. platform preview panels) — Lax cookies are silently dropped
 *   there, which makes every login "fall back" to the sign-in form.
 * - Over plain local HTTP (dev) browsers reject None-without-Secure, so we use
 *   Lax. Chrome/Firefox allow Secure cookies on http://localhost, so forcing
 *   None via SESSION_COOKIE_SAMESITE=none still works for local E2E testing.
 * - SESSION_COOKIE_SAMESITE env var overrides the automatic choice
 *   ("none" | "lax"). Automatic: HTTPS (forwarded proto or production) → None,
 *   otherwise → Lax.
 */
async function cookieSameSite(): Promise<"none" | "lax"> {
  const override = process.env.SESSION_COOKIE_SAMESITE?.toLowerCase();
  if (override === "none" || override === "lax") return override;
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0]?.trim();
  const isHttps = proto === "https" || process.env.NODE_ENV === "production";
  return isHttps ? "none" : "lax";
}

export type Role = "CUSTOMER" | "OWNER" | "ADMIN" | "ORDER_MANAGER" | "CONTENT_MANAGER";

export const STAFF_ROLES: Role[] = ["OWNER", "ADMIN", "ORDER_MANAGER", "CONTENT_MANAGER"];

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
}

// ───────────────────────── passwords ─────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Password must contain letters and numbers.";
  return null;
}

// ───────────────────────── sessions ─────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { token: hashToken(raw), userId, expiresAt },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: await cookieSameSite(),
    // Secure is mandatory whenever SameSite=None (browsers reject the pairing
    // None-without-Secure); it is also correct for production HTTPS.
    secure: process.env.SESSION_COOKIE_SAMESITE?.toLowerCase() === "none" ||
      process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    await db.session.deleteMany({ where: { token: hashToken(raw) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Returns the current user for API/pages, or null. Cleans up expired sessions. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const session = await db.session.findUnique({
    where: { token: hashToken(raw) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now() || !session.user.isActive) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as Role,
    phone: session.user.phone,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Authentication required.", 401);
  return user;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError("Insufficient permissions.", 403);
  return user;
}

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

// ───────────────────────── audit ─────────────────────────

export async function audit(
  actor: SessionUser | null,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: unknown
): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action,
      entity: entity ?? null,
      entityId: entityId ?? null,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

// ───────────────────────── password reset ─────────────────────────

export function generateResetToken(): { raw: string; hashed: string } {
  const raw = randomBytes(24).toString("hex");
  return { raw, hashed: hashToken(raw) };
}

export function hashResetToken(raw: string): string {
  return hashToken(raw);
}
