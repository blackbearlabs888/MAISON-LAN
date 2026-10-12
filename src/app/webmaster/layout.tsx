// Plain passthrough — the real guard + sidebar live in the (dashboard) route
// group so /webmaster/setup stays reachable without a session.

export default function WebmasterRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
