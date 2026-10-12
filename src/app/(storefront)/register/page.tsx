import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser().catch(() => null);

  // Already signed in — no reason to offer registration again.
  if (user) {
    redirect(isStaff(user.role) ? "/webmaster" : "/account");
  }

  return <RegisterForm />;
}
