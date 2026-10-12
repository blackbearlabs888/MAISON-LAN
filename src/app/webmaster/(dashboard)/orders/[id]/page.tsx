"use client";

// Order workspace — status transitions, manual payment confirmation, admin
// notes and the shipment (courier/tracking) panel with status history.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  MapPin,
  NotebookPen,
  PackageCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  fmtDateTime,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  parseAddress,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type Courier,
  type OrderDetailResponse,
  type OrderStatus,
  type ShipmentStatus,
} from "@/lib/webmaster-client";
import { useStoreConfig } from "@/lib/store-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ErrorState,
  InlineSpinner,
  Money,
  OrderStatusBadge,
  PageHeader,
  PaymentStatusBadge,
  SectionLabel,
  ShipmentStatusBadge,
  SimpleBadge,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id ?? "";
  const { format } = useStoreConfig();

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrderDetailResponse | null>(null);

  // status transition
  const [nextStatus, setNextStatus] = useState<string>("");
  const [statusNote, setStatusNote] = useState("");
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  // payment confirmation
  const [payRef, setPayRef] = useState("");
  const [confirmPayOpen, setConfirmPayOpen] = useState(false);
  const [confirmingPay, setConfirmingPay] = useState(false);

  // admin note
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // shipment
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [courierId, setCourierId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [estimated, setEstimated] = useState("");
  const [shipmentNote, setShipmentNote] = useState("");
  const [savingShipment, setSavingShipment] = useState(false);
  const [editShipmentOpen, setEditShipmentOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ShipmentStatus | "">("");
  const [newStatusNote, setNewStatusNote] = useState("");
  const [applyingShipmentStatus, setApplyingShipmentStatus] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await apiGet<OrderDetailResponse>(`/api/webmaster/orders/${orderId}`);
      setData(res);
      setNote(res.order.adminNote ?? "");
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order.");
      setPhase("error");
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) void load();
  }, [orderId, load]);

  useEffect(() => {
    apiGet<{ couriers: Courier[] }>("/api/webmaster/couriers")
      .then((res) => setCouriers(res.couriers.filter((c) => c.isActive)))
      .catch(() => undefined); // non-blocking; select shows a fallback
  }, []);

  if (phase === "loading") {
    return (
      <div>
        <PageHeader title="Order" description="Loading order workspace…" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <InlineSpinner /> Fetching order…
        </div>
      </div>
    );
  }

  if (phase === "error" || !data) {
    return (
      <div>
        <PageHeader title="Order" />
        <ErrorState message={error ?? "Failed to load order."} onRetry={() => void load()} />
      </div>
    );
  }

  const order = data.order;
  const address = parseAddress(order.shippingAddress);
  const transitions = ORDER_TRANSITIONS[order.status] ?? [];
  const shipment = order.shipment;

  function openShipmentDialog() {
    if (shipment) {
      const match = couriers.find((c) => c.name === shipment.courierName);
      setCourierId((cur) => cur || match?.id || "");
      setTrackingNumber((cur) => cur || shipment.trackingNumber || "");
      setEstimated((cur) => cur || shipment.estimatedDelivery || "");
      setShipmentNote((cur) => cur || shipment.note || "");
    }
    setEditShipmentOpen(true);
  }

  async function applyStatus() {
    if (!nextStatus) return;
    setApplying(true);
    try {
      await apiPatch(`/api/webmaster/orders/${orderId}`, {
        action: "status",
        status: nextStatus,
        note: statusNote.trim() || undefined,
      });
      toast.success(`Status updated to ${ORDER_STATUS_LABELS[nextStatus as OrderStatus]}.`);
      setConfirmStatusOpen(false);
      setNextStatus("");
      setStatusNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status change failed.");
    } finally {
      setApplying(false);
    }
  }

  async function confirmPayment() {
    setConfirmingPay(true);
    try {
      await apiPatch(`/api/webmaster/orders/${orderId}`, {
        action: "confirm-payment",
        reference: payRef.trim() || undefined,
      });
      toast.success("Payment confirmed.");
      setConfirmPayOpen(false);
      setPayRef("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment confirmation failed.");
    } finally {
      setConfirmingPay(false);
    }
  }

  async function saveNote() {
    setSavingNote(true);
    try {
      await apiPatch(`/api/webmaster/orders/${orderId}`, { action: "note", adminNote: note });
      toast.success("Internal note saved.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function saveShipment() {
    if (!courierId) {
      toast.error("Choose a courier first.");
      return;
    }
    setSavingShipment(true);
    try {
      await apiPut(`/api/webmaster/orders/${orderId}/shipment`, {
        courierId,
        trackingNumber: trackingNumber.trim() || undefined,
        estimatedDelivery: estimated.trim() || undefined,
        note: shipmentNote.trim() || undefined,
      });
      toast.success("Shipment saved.");
      setEditShipmentOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save shipment.");
    } finally {
      setSavingShipment(false);
    }
  }

  async function applyShipmentStatus() {
    if (!newStatus) return;
    setApplyingShipmentStatus(true);
    try {
      await apiPost(`/api/webmaster/orders/${orderId}/shipment`, {
        status: newStatus,
        note: newStatusNote.trim() || undefined,
      });
      toast.success(`Shipment marked ${SHIPMENT_STATUS_LABELS[newStatus]}.`);
      setNewStatus("");
      setNewStatusNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Shipment status change failed.");
    } finally {
      setApplyingShipmentStatus(false);
    }
  }

  const shipmentForm = (
    <div className="space-y-4">
      <div>
        <Label className="text-[13px] font-light">Courier</Label>
        <Select value={courierId} onValueChange={setCourierId}>
          <SelectTrigger className="mt-1.5 h-10 rounded-none" aria-label="Courier">
            <SelectValue placeholder="Select courier" />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            {couriers.length === 0 ? (
              <SelectItem value="__none" disabled>
                No active couriers — add one in Shipping
              </SelectItem>
            ) : (
              couriers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="ship-tracking" className="text-[13px] font-light">
          Tracking number
        </Label>
        <Input
          id="ship-tracking"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          className="mt-1.5 h-10 rounded-none"
          placeholder="e.g. ME8845120ID"
        />
      </div>
      <div>
        <Label htmlFor="ship-eta" className="text-[13px] font-light">
          Estimated delivery
        </Label>
        <Input
          id="ship-eta"
          value={estimated}
          onChange={(e) => setEstimated(e.target.value)}
          className="mt-1.5 h-10 rounded-none"
          placeholder="e.g. 3–5 business days"
        />
      </div>
      <div>
        <Label htmlFor="ship-note" className="text-[13px] font-light">
          Note (optional)
        </Label>
        <Textarea
          id="ship-note"
          value={shipmentNote}
          onChange={(e) => setShipmentNote(e.target.value)}
          className="mt-1.5 min-h-20 rounded-none"
        />
      </div>
      <Button onClick={() => void saveShipment()} disabled={savingShipment} className="rounded-none">
        {savingShipment ? (
          <>
            <InlineSpinner /> Saving…
          </>
        ) : (
          "Save shipment"
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        Tracking updates are manual, not synchronized with the courier.
      </p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 rounded-none text-muted-foreground">
          <Link href="/webmaster/orders">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All orders
          </Link>
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-display text-3xl tracking-tight">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Placed {fmtDateTime(order.createdAt)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.paymentStatus} />
              {shipment ? <ShipmentStatusBadge status={shipment.status} /> : null}
            </div>
          </div>

          {/* Status transition */}
          <Card className="w-full rounded-none border-border shadow-none lg:w-96">
            <CardContent className="p-4">
              <SectionLabel>Move status forward</SectionLabel>
              {transitions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  This order is in a terminal state — no further transitions.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  <Select value={nextStatus} onValueChange={setNextStatus}>
                    <SelectTrigger className="h-10 rounded-none" aria-label="Next status">
                      <SelectValue placeholder="Choose next status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {transitions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ORDER_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Internal note for this change (optional)"
                    className="h-10 rounded-none"
                    maxLength={500}
                  />
                  <Button
                    className="w-full rounded-none"
                    disabled={!nextStatus || applying}
                    onClick={() => setConfirmStatusOpen(true)}
                  >
                    {applying ? <InlineSpinner /> : "Apply change"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Customer & address */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="editorial-label flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> Customer &amp; shipping address
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium">{order.customerName}</p>
                <p className="text-muted-foreground">{order.email}</p>
                <p className="text-muted-foreground">{order.phone}</p>
                {data.customer ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Registered customer since {fmtDateTime(data.customer.createdAt)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Guest checkout</p>
                )}
                {order.customerNote ? (
                  <p className="mt-3 border-l-2 border-[#9a7b4f] pl-3 text-xs italic text-muted-foreground">
                    “{order.customerNote}”
                  </p>
                ) : null}
              </div>
              <div className="text-sm">
                {address ? (
                  <>
                    <p>{address.fullName ?? order.customerName}</p>
                    <p className="text-muted-foreground">{address.line1}</p>
                    {address.line2 ? <p className="text-muted-foreground">{address.line2}</p> : null}
                    <p className="text-muted-foreground">
                      {address.city}, {address.province} {address.postalCode}
                    </p>
                    <p className="text-muted-foreground">{address.country}</p>
                    {address.phone ? <p className="mt-1 text-muted-foreground">{address.phone}</p> : null}
                  </>
                ) : (
                  <p className="text-muted-foreground">{order.shippingAddress}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="editorial-label text-muted-foreground">Items</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Item</TableHead>
                    <TableHead>Unit price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="pr-6 text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="pl-6">
                        <p className="font-medium">{it.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.sku}
                          {it.size ? ` · Size ${it.size}` : ""}
                          {it.color ? ` · ${it.color}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Money cents={it.unitPriceCents} />
                      </TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell className="pr-6 text-right">
                        <Money cents={it.lineTotalCents} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator />
              <div className="space-y-1.5 px-6 py-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <Money cents={order.subtotalCents} />
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping{order.shippingMethod ? ` — ${order.shippingMethod}` : ""}</span>
                  <Money cents={order.shippingCostCents} />
                </div>
                <div className="flex justify-between pt-1 font-display text-lg">
                  <span>Total</span>
                  <Money cents={order.totalCents} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status history */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="editorial-label text-muted-foreground">Status history</CardTitle>
            </CardHeader>
            <CardContent>
              {order.statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recorded transitions yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {order.statusHistory.map((h) => (
                    <li key={h.id} className="relative">
                      <span
                        className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border border-border bg-[#9a7b4f]"
                        aria-hidden
                      />
                      <p className="text-sm">
                        {h.fromStatus ? `${ORDER_STATUS_LABELS[h.fromStatus as OrderStatus] ?? h.fromStatus} → ` : ""}
                        <span className="font-medium">
                          {ORDER_STATUS_LABELS[h.toStatus as OrderStatus] ?? h.toStatus}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDateTime(h.createdAt)}
                        {h.actorLabel ? ` · ${h.actorLabel}` : ""}
                      </p>
                      {h.note ? <p className="mt-0.5 text-xs italic text-muted-foreground">“{h.note}”</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT column */}
        <div className="space-y-4">
          {/* Payment */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="editorial-label flex items-center gap-2 text-muted-foreground">
                <Banknote className="h-3.5 w-3.5" aria-hidden /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">State</span>
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="text-xs">{order.paymentMethod}</span>
              </div>

              {order.paymentStatus === "UNPAID" ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <Label htmlFor="pay-ref" className="text-[13px] font-light">
                    Transfer reference (optional)
                  </Label>
                  <Input
                    id="pay-ref"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="h-10 rounded-none"
                    placeholder="Bank ref / sender name"
                    maxLength={120}
                  />
                  <Button
                    className="w-full rounded-none"
                    disabled={confirmingPay}
                    onClick={() => setConfirmPayOpen(true)}
                  >
                    {confirmingPay ? <InlineSpinner /> : "Confirm payment"}
                  </Button>
                </div>
              ) : null}

              {order.paymentRecords.length > 0 ? (
                <div className="border-t border-border pt-3">
                  <SectionLabel>Confirmed payments</SectionLabel>
                  <ul className="mt-2 space-y-2">
                    {order.paymentRecords.map((p) => (
                      <li key={p.id} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <Money cents={p.amountCents} className="font-medium" />
                          <span className="text-muted-foreground">{fmtDateTime(p.confirmedAt)}</span>
                        </div>
                        {p.reference ? <p className="text-muted-foreground">Ref: {p.reference}</p> : null}
                        {p.note ? <p className="text-muted-foreground">{p.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Shipment */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="editorial-label flex items-center gap-2 text-muted-foreground">
                <Truck className="h-3.5 w-3.5" aria-hidden /> Shipment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {shipment ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <ShipmentStatusBadge status={shipment.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Courier</span>
                    <span>{shipment.courierName ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Tracking</span>
                    {shipment.trackingNumber ? (
                      shipment.trackingUrl ? (
                        <a
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4 hover:text-[#7d6134]"
                        >
                          {shipment.trackingNumber}
                        </a>
                      ) : (
                        <span>{shipment.trackingNumber}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Est. delivery</span>
                    <span>{shipment.estimatedDelivery ?? "—"}</span>
                  </div>
                  {shipment.note ? (
                    <p className="text-xs italic text-muted-foreground">{shipment.note}</p>
                  ) : null}

                  <div className="flex gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-none"
                      onClick={openShipmentDialog}
                    >
                      Update details
                    </Button>
                  </div>

                  {/* status change */}
                  <div className="space-y-2 border-t border-border pt-3">
                    <SectionLabel>Record shipment progress</SectionLabel>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ShipmentStatus)}>
                      <SelectTrigger className="h-10 rounded-none" aria-label="Shipment status">
                        <SelectValue placeholder="New status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        {SHIPMENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SHIPMENT_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={newStatusNote}
                      onChange={(e) => setNewStatusNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="h-10 rounded-none"
                      maxLength={500}
                    />
                    <Button
                      variant="outline"
                      className="w-full rounded-none"
                      disabled={!newStatus || applyingShipmentStatus}
                      onClick={() => void applyShipmentStatus()}
                    >
                      {applyingShipmentStatus ? <InlineSpinner /> : "Update shipment status"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Tracking updates are manual, not synchronized with the courier. Dispatch (In transit)
                      and delivery move the order automatically.
                    </p>
                  </div>

                  {shipment.statusHistory.length > 0 ? (
                    <div className="border-t border-border pt-3">
                      <SectionLabel>Shipment history</SectionLabel>
                      <ol className="relative mt-3 space-y-3 border-l border-border pl-5">
                        {shipment.statusHistory.map((h) => (
                          <li key={h.id} className="relative">
                            <span
                              className="absolute -left-[26px] top-1 h-2 w-2 rounded-full bg-[#9a7b4f]"
                              aria-hidden
                            />
                            <p className="text-xs font-medium">{SHIPMENT_STATUS_LABELS[h.status] ?? h.status}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtDateTime(h.createdAt)}
                              {h.note ? ` · ${h.note}` : ""}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    No shipment yet. Choose a courier and add a tracking number once the parcel is booked.
                  </p>
                  {shipmentForm}
                </>
              )}
            </CardContent>
          </Card>

          {/* Internal note */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="editorial-label flex items-center gap-2 text-muted-foreground">
                <NotebookPen className="h-3.5 w-3.5" aria-hidden /> Internal note
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-24 rounded-none"
                placeholder="Visible to staff only…"
                maxLength={1000}
              />
              <Button
                variant="outline"
                className="w-full rounded-none"
                onClick={() => void saveNote()}
                disabled={savingNote}
              >
                {savingNote ? <InlineSpinner /> : "Save note"}
              </Button>
            </CardContent>
          </Card>

          {/* Order meta */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="editorial-label flex items-center gap-2 text-muted-foreground">
                <PackageCheck className="h-3.5 w-3.5" aria-hidden /> Timestamps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <p>Created · {fmtDateTime(order.createdAt)}</p>
              {order.paidAt ? <p>Paid · {fmtDateTime(order.paidAt)}</p> : null}
              {order.completedAt ? <p>Completed · {fmtDateTime(order.completedAt)}</p> : null}
              {order.cancelledAt ? <p>Cancelled · {fmtDateTime(order.cancelledAt)}</p> : null}
              {order.cancellationReason ? <p>Reason · {order.cancellationReason}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirm status change */}
      <AlertDialog open={confirmStatusOpen} onOpenChange={setConfirmStatusOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Change order status?</AlertDialogTitle>
            <AlertDialogDescription>
              {order.orderNumber} will move to{" "}
              <span className="font-medium text-foreground">
                {ORDER_STATUS_LABELS[nextStatus as OrderStatus] ?? nextStatus}
              </span>
              . This is recorded in the order history and cannot be undone from here.
              {nextStatus === "CANCELLED"
                ? " Cancelled orders restock their reserved items automatically."
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none"
              onClick={(e) => {
                e.preventDefault();
                void applyStatus();
              }}
            >
              {applying ? <InlineSpinner /> : "Confirm change"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm payment */}
      <AlertDialog open={confirmPayOpen} onOpenChange={setConfirmPayOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Confirm manual payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {format(order.totalCents)} received for {order.orderNumber}? Payment records are kept as an
              audit trail; pending orders move to Paid automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none"
              onClick={(e) => {
                e.preventDefault();
                void confirmPayment();
              }}
            >
              {confirmingPay ? <InlineSpinner /> : "Confirm payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit shipment dialog */}
      <Dialog open={editShipmentOpen} onOpenChange={setEditShipmentOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Update shipment details</DialogTitle>
          </DialogHeader>
          <div className="pt-2">{shipmentForm}</div>
          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" className="rounded-none" onClick={() => setEditShipmentOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {order.status === "CANCELLED" ? (
        <div className="mt-6">
          <SimpleBadge tone="red">This order was cancelled</SimpleBadge>
        </div>
      ) : null}
    </div>
  );
}
