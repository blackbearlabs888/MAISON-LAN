// Guarded webmaster shell: session + staff-role gate, capability-filtered
// navigation, and store settings provided for currency/locale formatting.
// NOTE: hiding UI is cosmetic — every API route re-checks auth server-side.

import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getStoreSettings } from "@/lib/store-settings";
import { StoreConfigProvider } from "@/lib/store-config";
import { WebmasterShell } from "@/components/webmaster/webmaster-shell";

export default async function WebmasterDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/webmaster");
  if (!isStaff(user.role)) redirect("/login?next=/webmaster");

  const settings = await getStoreSettings();

  return (
    <StoreConfigProvider settings={settings}>
      <WebmasterShell user={{ name: user.name, email: user.email, role: user.role }}>
        {children}
      </WebmasterShell>
    </StoreConfigProvider>
  );
}
