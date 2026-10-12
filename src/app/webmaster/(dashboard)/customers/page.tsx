"use client";

// Customers — searchable list with a detail dialog (orders, spend) and
// disable / reactivate actions.

import { useCallback, useEffect, useState } from "react";
import { Eye, Search } from "lucide-react";
import { toast } from "sonner";
import {
  apiGet,
  apiPatch,
  fmtDate,
  type CustomerDetailResponse,
  type CustomerListResponse,
} from "@/lib/webmaster-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  Money,
  OrderStatusBadge,
  PageHeader,
  Pager,
  PaymentStatusBadge,
  SimpleBadge,
  TableSkeleton,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";

export default function CustomersPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CustomerListResponse | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<CustomerDetailResponse | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<{ id: string; name: string; next: boolean } | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debounced) params.set("q", debounced);
      const res = await apiGet<CustomerListResponse>(`/api/webmaster/customers?${params.toString()}`);
      setData(res);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers.");
      setPhase("error");
    }
  }, [debounced, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiGet<CustomerDetailResponse>(`/api/webmaster/customers/${id}`);
      setDetail(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load customer.");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleActive() {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      await apiPatch(`/api/webmaster/customers/${toggleTarget.id}`, { isActive: toggleTarget.next });
      toast.success(
        toggleTarget.next
          ? `${toggleTarget.name} reactivated.`
          : `${toggleTarget.name} disabled — active sessions were terminated.`
      );
      setToggleTarget(null);
      if (detail?.customer.id === toggleTarget.id) {
        setDetail((d) => (d ? { ...d, customer: { ...d.customer, isActive: toggleTarget.next } } : d));
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <div>
      <PageHeader title="Customers" description="Registered accounts, order counts and lifetime spend." />

      <div className="relative mb-4 md:w-96">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          className="h-10 rounded-none pl-9"
          aria-label="Search customers"
        />
      </div>

      <div className="border border-border bg-card">
        {phase === "loading" ? (
          <TableSkeleton rows={6} cols={6} />
        ) : phase === "error" ? (
          <ErrorState message={error ?? "Failed to load customers."} onRetry={() => void load()} />
        ) : !data || data.customers.length === 0 ? (
          <EmptyState title="No customers found" hint={debounced ? "Try a different search." : "Customers appear here after they register."} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Total spent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-4">
                      <p className="font-medium">{c.name}</p>
                      <p className="max-w-56 truncate text-xs text-muted-foreground">{c.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                    <TableCell>{c.orderCount}</TableCell>
                    <TableCell>
                      <Money cents={c.totalSpentCents} />
                    </TableCell>
                    <TableCell>
                      <SimpleBadge tone={c.isActive ? "green" : "red"}>
                        {c.isActive ? "Active" : "Disabled"}
                      </SimpleBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(c.createdAt)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-none"
                          onClick={() => void openDetail(c.id)}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden /> View
                        </Button>
                        <Button
                          variant={c.isActive ? "outline" : "default"}
                          size="sm"
                          className={
                            c.isActive
                              ? "h-8 rounded-none text-destructive"
                              : "h-8 rounded-none bg-primary text-primary-foreground"
                          }
                          onClick={() =>
                            setToggleTarget({ id: c.id, name: c.name, next: !c.isActive })
                          }
                        >
                          {c.isActive ? "Disable" : "Reactivate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setPage(p)} />
          </>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] rounded-none sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{detail?.customer.name ?? "Customer"}</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-[#9a7b4f]" aria-hidden />
              Loading customer…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="editorial-label text-muted-foreground">Email</p>
                  <p>{detail.customer.email}</p>
                </div>
                <div>
                  <p className="editorial-label text-muted-foreground">Phone</p>
                  <p>{detail.customer.phone ?? "—"}</p>
                </div>
                <div>
                  <p className="editorial-label text-muted-foreground">Member since</p>
                  <p>{fmtDate(detail.customer.createdAt)}</p>
                </div>
                <div>
                  <p className="editorial-label text-muted-foreground">Status</p>
                  <SimpleBadge tone={detail.customer.isActive ? "green" : "red"}>
                    {detail.customer.isActive ? "Active" : "Disabled"}
                  </SimpleBadge>
                </div>
              </div>

              <div>
                <p className="editorial-label mb-2 text-muted-foreground">Recent orders (last 20)</p>
                {detail.orders.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <div className="scroll-slim max-h-96 overflow-y-auto border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-3">Order</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="pr-3 text-right">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="pl-3 font-medium">{o.orderNumber}</TableCell>
                            <TableCell>
                              <OrderStatusBadge status={o.status} />
                            </TableCell>
                            <TableCell>
                              <PaymentStatusBadge status={o.paymentStatus} />
                            </TableCell>
                            <TableCell>
                              <Money cents={o.totalCents} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap pr-3 text-right text-xs text-muted-foreground">
                              {fmtDate(o.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable / reactivate confirm */}
      <AlertDialog open={toggleTarget !== null} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {toggleTarget?.next ? "Reactivate account?" : "Disable account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.next
                ? `${toggleTarget?.name} will be able to sign in again.`
                : `${toggleTarget?.name} will be signed out everywhere and unable to sign in until reactivated. Order history is kept.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none"
              onClick={(e) => {
                e.preventDefault();
                void toggleActive();
              }}
            >
              {toggling ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
