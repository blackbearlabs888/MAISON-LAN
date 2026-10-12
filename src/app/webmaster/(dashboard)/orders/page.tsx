"use client";

// Orders — searchable, filterable, paged list. Rows open the order workspace.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  apiGet,
  fmtDateTime,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type OrderListResponse,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/webmaster-client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  Money,
  OrderStatusBadge,
  PageHeader,
  Pager,
  PaymentStatusBadge,
  TableSkeleton,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";
const PAGE_SIZE = 15;

export default function OrdersListPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrderListResponse | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [payment, setPayment] = useState<string>("all");
  const [page, setPage] = useState(1);
  const lastDebounced = useRef("");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = search.trim();
      // Only react to an actual query change — an unconditional setPhase("loading")
      // here made the page stick on the skeleton forever (no refetch follows).
      if (next === lastDebounced.current) return;
      lastDebounced.current = next;
      setDebounced(next);
      setPage(1);
      setPhase("loading");
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debounced) params.set("q", debounced);
      if (status !== "all") params.set("status", status);
      if (payment !== "all") params.set("payment", payment);
      const res = await apiGet<OrderListResponse>(`/api/webmaster/orders?${params.toString()}`);
      setData(res);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
      setPhase("error");
    }
  }, [debounced, status, payment, page]);

  useEffect(() => {
    // Async fetch — setState resolves after await, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manual payment verification and fulfilment workspace."
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order number, customer or email…"
            className="h-10 rounded-none pl-9"
            aria-label="Search orders"
          />
        </div>
        <div className="flex gap-3">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
              setPhase("loading");
            }}
          >
            <SelectTrigger className="h-10 w-[170px] rounded-none" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all">All statuses</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={payment}
            onValueChange={(v) => {
              setPayment(v);
              setPage(1);
              setPhase("loading");
            }}
          >
            <SelectTrigger className="h-10 w-[140px] rounded-none" aria-label="Filter by payment">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all">All payments</SelectItem>
              {PAYMENT_STATUSES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PAYMENT_STATUS_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-border bg-card">
        {phase === "loading" ? (
          <TableSkeleton rows={6} cols={6} />
        ) : phase === "error" ? (
          <ErrorState
            message={error ?? "Failed to load orders."}
            onRetry={() => {
              setPhase("loading");
              void load();
            }}
          />
        ) : !data || data.orders.length === 0 ? (
          <EmptyState
            title="No orders match"
            hint="Try clearing the search or choosing a different status filter."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((o) => {
                  const shown = o.items.slice(0, 2);
                  const more = Math.max(0, o.items.length - shown.length);
                  return (
                    <TableRow
                      key={o.id}
                      onClick={() => router.push(`/webmaster/orders/${o.id}`)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">{o.orderNumber}</TableCell>
                      <TableCell>
                        <p className="max-w-44 truncate">{o.customerName}</p>
                        <p className="max-w-44 truncate text-xs text-muted-foreground">{o.email}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {shown.map((it, i) => (
                          <p key={i} className="max-w-44 truncate">
                            {it.quantity}× {it.name}
                          </p>
                        ))}
                        {more > 0 ? <p className="text-muted-foreground">+{more} more item{more === 1 ? "" : "s"}</p> : null}
                      </TableCell>
                      <TableCell>
                        <Money cents={o.totalCents} />
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={o.paymentStatus as PaymentStatus} />
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status as OrderStatus} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.shipment?.trackingNumber ? (
                          <span>
                            <span className="text-muted-foreground">{o.shipment.courierName ?? "Courier"}: </span>
                            {o.shipment.trackingNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                        {fmtDateTime(o.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pager
              page={data.page}
              pageSize={data.pageSize || PAGE_SIZE}
              total={data.total}
              onPage={(p) => setPage(p)}
            />
          </>
        )}
      </div>
    </div>
  );
}
