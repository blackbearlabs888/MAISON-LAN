import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/** Only allow same-site relative destinations (blocks open redirects). */
function safeNext(next: string | undefined): string | undefined {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const user = await getCurrentUser().catch(() => null);

  // Already signed in — the sign-in form must never reappear. Honour `next`
  // only when the user is actually allowed to go there (a customer with
  // next=/webmaster would otherwise loop /login ↔ /webmaster guard forever).
  if (user) {
    const staffDefault = isStaff(user.role) ? "/webmaster" : "/account";
    const target =
      next && !(next.startsWith("/webmaster") && !isStaff(user.role))
        ? next
        : staffDefault;
    redirect(target);
  }

  return <LoginForm next={next} />;
}
