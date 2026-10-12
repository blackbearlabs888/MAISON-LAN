"use client";

// Dashboard — KPI overview, 14-day revenue trend, best sellers, low stock,
// recent orders and Telegram health. Data: GET /api/webmaster/stats.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CircleDollarSign,
  Package,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";
import { apiGet, fmtDateTime, type StatsResponse } from "@/lib/webmaster-client";
import { useStoreConfig } from "@/lib/store-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ErrorState,
  InlineSpinner,
  Money,
  OrderStatusBadge,
  PageHeader,
  SectionLabel,
  SimpleBadge,
} from "@/components/webmaster/ui-bits";
import { cn } from "@/lib/utils";

type Phase = "loading" | "ready" | "error";

const BRAND = "#9a7b4f";

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-none border-border shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <SectionLabel>{label}</SectionLabel>
          <Icon className="h-4 w-4 shrink-0 text-[#9a7b4f]" aria-hidden />
        </div>
        <p className="mt-3 font-display text-3xl leading-none tracking-tight">{value}</p>
        {sub ? <div className="mt-2 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

function HealthCard({ health }: { health: StatsResponse["telegramHealth"] }) {
  const dot =
    health === "HEALTHY"
      ? "bg-emerald-500"
      : health === "DEGRADED"
        ? "bg-amber-500"
        : health === "FAILING"
          ? "bg-red-500"
          : "bg-stone-400";
  const label =
    health === "HEALTHY"
      ? "Healthy"
      : health === "DEGRADED"
        ? "Degraded — recent failures"
        : health === "FAILING"
          ? "Failing — all recent sends failed"
          : "Not configured";
  return (
    <Card className="rounded-none border-border shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="editorial-label text-muted-foreground">Telegram notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", dot)} aria-hidden />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Manual-order alerts, shipment updates and low-stock warnings.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3 rounded-none">
          <Link href="/webmaster/notifications">Open notifications</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function WebmasterDashboardPage() {
  const router = useRouter();
  const { format } = useStoreConfig();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  // Fetch on mount and whenever reloadKey changes. State updates happen in
  // promise callbacks (never synchronously inside the effect body).
  useEffect(() => {
    let cancelled = false;
    apiGet<StatsResponse>("/api/webmaster/stats")
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function refresh() {
    setPhase("loading");
    setReloadKey((k) => k + 1);
  }

  if (phase === "loading") {
    return (
      <div>
        <PageHeader title="Dashboard" description="Loading today's picture of the boutique…" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <InlineSpinner /> Fetching metrics…
        </div>
      </div>
    );
  }

  if (phase === "error" || !data) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <ErrorState message={error ?? "Failed to load dashboard."} onRetry={refresh} />
      </div>
    );
  }

  const { stats, recentOrders, bestSellers, lowStock, trend, notifications } = data;

  const momPct =
    stats.lastMonthRevenueCents > 0
      ? Math.round(
          ((stats.monthRevenueCents - stats.lastMonthRevenueCents) / stats.lastMonthRevenueCents) * 100
        )
      : stats.monthRevenueCents > 0
        ? 100
        : 0;
  const momUp = momPct >= 0;

  const chartData = trend.map((t) => ({
    ...t,
    label: new Date(`${t.date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Storefront performance at a glance."
        actions={
          <Button variant="outline" size="sm" className="rounded-none" onClick={refresh}>
            Refresh
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Total orders" value={stats.totalOrders} icon={ShoppingBag} />
        <KpiCard label="Pending payment" value={stats.pendingOrders} icon={CircleDollarSign} />
        <KpiCard label="To ship" value={stats.toShip} icon={Truck} sub="Paid · Processing · Ready" />
        <KpiCard
          label="Revenue (all time)"
          value={<Money cents={stats.revenueCents} />}
          icon={CircleDollarSign}
          sub={<span>Paid &amp; fulfilled statuses only</span>}
        />
        <KpiCard
          label="Revenue this month"
          value={<Money cents={stats.monthRevenueCents} />}
          icon={CircleDollarSign}
          sub={
            <span className="inline-flex items-center gap-1">
              {momUp ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-red-700" aria-hidden />
              )}
              <span className={momUp ? "text-emerald-700" : "text-red-700"}>
                {momUp ? "+" : ""}
                {momPct}%
              </span>
              <span>vs last month ({format(stats.lastMonthRevenueCents)})</span>
            </span>
          }
        />
        <div className="grid gap-4">
          <KpiCard label="Customers" value={stats.customerCount} icon={Users} />
          <KpiCard label="Products" value={stats.productCount} icon={Package} />
        </div>
      </div>

      {/* Trend */}
      <Card className="mt-6 rounded-none border-border shadow-none">
        <CardHeader className="pb-0">
          <CardTitle className="editorial-label text-muted-foreground">Revenue — last 14 days</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#8a8175" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e7e0d4" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#8a8175" }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(v: number) =>
                    new Intl.NumberFormat("en", { notation: "compact" }).format(v)
                  }
                />
                <Tooltip
                  formatter={(value) => [format(Number(value) * 100), "Revenue"]}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    borderRadius: 0,
                    border: "1px solid #e7e0d4",
                    fontSize: 12,
                    background: "#ffffff",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={BRAND}
                  strokeWidth={1.5}
                  fill="url(#revFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Lists row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-none border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="editorial-label text-muted-foreground">Best sellers</CardTitle>
          </CardHeader>
          <CardContent>
            {bestSellers.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No sales recorded yet.</p>
            ) : (
              <ul className="scroll-slim max-h-96 space-y-2 overflow-y-auto pr-1">
                {bestSellers.map((b, i) => (
                  <li key={b.name} className="flex items-center justify-between gap-3 border-b border-border/70 pb-2 last:border-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-display text-lg leading-none text-[#9a7b4f]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate text-sm">{b.name}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{b.quantity} sold</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="editorial-label text-muted-foreground">Low stock</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">All variants are comfortably stocked.</p>
            ) : (
              <ul className="scroll-slim max-h-96 space-y-2 overflow-y-auto pr-1">
                {lowStock.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 border-b border-border/70 pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{v.product.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.sku}
                        {v.size ? ` · ${v.size}` : ""}
                        {v.color ? ` · ${v.color}` : ""}
                      </p>
                    </div>
                    <SimpleBadge tone={v.stock === 0 ? "red" : "amber"}>{v.stock} left</SimpleBadge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders + Telegram */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-none border-border shadow-none lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="editorial-label text-muted-foreground">Recent orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="scroll-slim max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="editorial-label pb-2 pr-3 font-medium text-muted-foreground">Order</th>
                      <th className="editorial-label pb-2 pr-3 font-medium text-muted-foreground">Customer</th>
                      <th className="editorial-label pb-2 pr-3 font-medium text-muted-foreground">Total</th>
                      <th className="editorial-label pb-2 pr-3 font-medium text-muted-foreground">Status</th>
                      <th className="editorial-label pb-2 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => router.push(`/webmaster/orders/${o.id}`)}
                        className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/50"
                      >
                        <td className="py-2.5 pr-3 font-medium">{o.orderNumber}</td>
                        <td className="max-w-40 truncate py-2.5 pr-3">{o.customerName}</td>
                        <td className="py-2.5 pr-3">
                          <Money cents={o.totalCents} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <OrderStatusBadge status={o.status} />
                        </td>
                        <td className="whitespace-nowrap py-2.5 text-xs text-muted-foreground">
                          {fmtDateTime(o.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <HealthCard health={data.telegramHealth} />
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="editorial-label flex items-center gap-2 text-muted-foreground">
                <BellRing className="h-3.5 w-3.5" aria-hidden /> Latest notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Nothing sent yet.</p>
              ) : (
                <ul className="scroll-slim max-h-48 space-y-2 overflow-y-auto pr-1">
                  {notifications.map((n) => (
                    <li key={n.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium">{n.event}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <SimpleBadge tone={n.status === "SENT" ? "green" : n.status === "FAILED" ? "red" : "neutral"}>
                          {n.status}
                        </SimpleBadge>
                        <span className="text-muted-foreground">{fmtDateTime(n.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
