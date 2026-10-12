"use client";

// Shipping — courier management and per-courier shipping rates.
// Rates are shown for the courier selected below the courier list.

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2, PackageOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  centsToUnits,
  unitsToCents,
  type Courier,
  type CourierPayload,
  type ShippingRate,
  type ShippingRatePayload,
} from "@/lib/webmaster-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
  InlineSpinner,
  Money,
  PageHeader,
  SectionLabel,
  SimpleBadge,
  TableSkeleton,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";

interface CourierForm {
  id: string | null;
  name: string;
  code: string;
  description: string;
  trackingUrlTemplate: string;
  minDays: string;
  maxDays: string;
  isActive: boolean;
  position: string;
}

interface RateForm {
  id: string | null;
  courierId: string;
  name: string;
  type: "FLAT" | "REGION";
  region: string;
  rate: string; // units
  freeAbove: string; // units, "" = null
  isActive: boolean;
}

const EMPTY_COURIER: CourierForm = {
  id: null,
  name: "",
  code: "",
  description: "",
  trackingUrlTemplate: "",
  minDays: "",
  maxDays: "",
  isActive: true,
  position: "0",
};

const EMPTY_RATE: RateForm = {
  id: null,
  courierId: "",
  name: "",
  type: "FLAT",
  region: "*",
  rate: "",
  freeAbove: "",
  isActive: true,
};

export default function ShippingPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);

  const [selectedCourier, setSelectedCourier] = useState<string>("");
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);

  const [courierDialog, setCourierDialog] = useState(false);
  const [courierForm, setCourierForm] = useState<CourierForm>(EMPTY_COURIER);
  const [savingCourier, setSavingCourier] = useState(false);
  const [courierDelete, setCourierDelete] = useState<Courier | null>(null);
  const [deletingCourier, setDeletingCourier] = useState(false);

  const [rateDialog, setRateDialog] = useState(false);
  const [rateForm, setRateForm] = useState<RateForm>(EMPTY_RATE);
  const [savingRate, setSavingRate] = useState(false);
  const [rateDelete, setRateDelete] = useState<ShippingRate | null>(null);
  const [deletingRate, setDeletingRate] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await apiGet<{ couriers: Courier[] }>("/api/webmaster/couriers");
      setCouriers(res.couriers);
      setPhase("ready");
      setSelectedCourier((cur) => cur || res.couriers[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load couriers.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadRates = useCallback(async () => {
    if (!selectedCourier) {
      setRates([]);
      return;
    }
    setRatesLoading(true);
    try {
      const res = await apiGet<{ rates: ShippingRate[] }>(
        `/api/webmaster/rates?courierId=${encodeURIComponent(selectedCourier)}`
      );
      setRates(res.rates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load rates.");
    } finally {
      setRatesLoading(false);
    }
  }, [selectedCourier]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  const selectedName = useMemo(
    () => couriers.find((c) => c.id === selectedCourier)?.name ?? "",
    [couriers, selectedCourier]
  );

  // ── couriers ──

  function openCourierEdit(c?: Courier) {
    if (c) {
      setCourierForm({
        id: c.id,
        name: c.name,
        code: c.code,
        description: c.description ?? "",
        trackingUrlTemplate: c.trackingUrlTemplate ?? "",
        minDays: c.minDays === null ? "" : String(c.minDays),
        maxDays: c.maxDays === null ? "" : String(c.maxDays),
        isActive: c.isActive,
        position: String(c.position),
      });
    } else {
      setCourierForm({ ...EMPTY_COURIER, position: String(couriers.length) });
    }
    setCourierDialog(true);
  }

  async function saveCourier() {
    const f = courierForm;
    if (f.name.trim().length < 2) return toast.error("Courier name is too short.");
    if (!/^[A-Z0-9_]{2,24}$/.test(f.code.trim()))
      return toast.error("Code must be 2–24 uppercase letters, numbers or underscores (e.g. JNE_REG).");
    if (f.trackingUrlTemplate.trim() && !f.trackingUrlTemplate.includes("{trackingNumber}"))
      return toast.error("Tracking URL template must include the {trackingNumber} placeholder.");
    if (f.minDays.trim() && f.maxDays.trim() && Number(f.minDays) > Number(f.maxDays))
      return toast.error("Min days cannot exceed max days.");

    const payload: CourierPayload = {
      name: f.name.trim(),
      code: f.code.trim(),
      description: f.description.trim() || undefined,
      trackingUrlTemplate: f.trackingUrlTemplate.trim() || "",
      minDays: f.minDays.trim() ? Math.max(0, Math.round(Number(f.minDays))) : null,
      maxDays: f.maxDays.trim() ? Math.max(0, Math.round(Number(f.maxDays))) : null,
      isActive: f.isActive,
      position: Math.max(0, Math.round(Number(f.position) || 0)),
    };
    setSavingCourier(true);
    try {
      if (f.id) {
        await apiPut(`/api/webmaster/couriers/${f.id}`, payload);
        toast.success("Courier updated.");
      } else {
        await apiPost("/api/webmaster/couriers", payload);
        toast.success("Courier created.");
      }
      setCourierDialog(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingCourier(false);
    }
  }

  async function removeCourier() {
    if (!courierDelete) return;
    setDeletingCourier(true);
    try {
      const res = await apiDelete<{ deactivated?: boolean; deleted?: boolean; message?: string }>(
        `/api/webmaster/couriers/${courierDelete.id}`
      );
      if (res.deactivated) {
        toast.info(res.message ?? "Courier is referenced by shipments and was deactivated instead of deleted.");
      } else {
        toast.success(`“${courierDelete.name}” deleted.`);
      }
      setCourierDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingCourier(false);
    }
  }

  // ── rates ──

  function openRateEdit(r?: ShippingRate) {
    if (r) {
      setRateForm({
        id: r.id,
        courierId: r.courierId,
        name: r.name,
        type: r.type,
        region: r.region,
        rate: centsToUnits(r.rateCents),
        freeAbove: centsToUnits(r.freeAboveCents),
        isActive: r.isActive,
      });
    } else {
      setRateForm({ ...EMPTY_RATE, courierId: selectedCourier });
    }
    setRateDialog(true);
  }

  async function saveRate() {
    const f = rateForm;
    if (!f.courierId) return toast.error("Choose a courier.");
    if (f.name.trim().length < 2) return toast.error("Rate name is too short.");
    const rateCents = unitsToCents(f.rate);
    if (rateCents === null) return toast.error("Enter a valid rate.");
    let freeAbove: number | null = null;
    if (f.freeAbove.trim()) {
      freeAbove = unitsToCents(f.freeAbove);
      if (freeAbove === null) return toast.error("Free-above amount is not a valid number.");
    }
    if (f.type === "REGION" && !f.region.trim())
      return toast.error("Region rates need a region (province name, or * for any).");

    const payload: ShippingRatePayload = {
      courierId: f.courierId,
      name: f.name.trim(),
      type: f.type,
      region: f.type === "REGION" ? f.region.trim() : "*",
      rateCents,
      freeAboveCents: freeAbove,
      isActive: f.isActive,
    };
    setSavingRate(true);
    try {
      if (f.id) {
        await apiPut(`/api/webmaster/rates/${f.id}`, payload);
        toast.success("Rate updated.");
      } else {
        await apiPost("/api/webmaster/rates", payload);
        toast.success("Rate created.");
      }
      setRateDialog(false);
      await loadRates();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingRate(false);
    }
  }

  async function removeRate() {
    if (!rateDelete) return;
    setDeletingRate(true);
    try {
      await apiDelete(`/api/webmaster/rates/${rateDelete.id}`);
      toast.success(`Rate “${rateDelete.name}” deleted.`);
      setRateDelete(null);
      await Promise.all([loadRates(), load()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingRate(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Shipping"
        description="Couriers and manual shipping rates used at checkout."
        actions={
          <Button onClick={() => openCourierEdit()} className="rounded-none">
            <FilePlus2 className="h-4 w-4" aria-hidden /> New courier
          </Button>
        }
      />

      {phase === "loading" ? (
        <TableSkeleton rows={4} cols={4} />
      ) : phase === "error" ? (
        <ErrorState message={error ?? "Failed to load couriers."} onRetry={() => void load()} />
      ) : (
        <div className="space-y-6">
          {/* Couriers */}
          <div>
            <SectionLabel className="mb-3">Couriers ({couriers.length})</SectionLabel>
            {couriers.length === 0 ? (
              <EmptyState
                title="No couriers configured"
                hint="Add at least one active courier so customers can choose a shipping method."
                action={
                  <Button variant="outline" className="rounded-none" onClick={() => openCourierEdit()}>
                    Add courier
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {couriers.map((c) => (
                  <Card
                    key={c.id}
                    className={
                      selectedCourier === c.id
                        ? "rounded-none border-[#9a7b4f] shadow-none"
                        : "rounded-none border-border shadow-none"
                    }
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="truncate font-display text-xl">{c.name}</CardTitle>
                          <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
                        </div>
                        <SimpleBadge tone={c.isActive ? "green" : "neutral"}>
                          {c.isActive ? "Active" : "Inactive"}
                        </SimpleBadge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {c.description ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {c.minDays !== null || c.maxDays !== null
                          ? `${c.minDays ?? "?"}–${c.maxDays ?? "?"} days`
                          : "No delivery estimate"}
                        {" · "}
                        {c._count?.rates ?? c.rates.length} rate{((c._count?.rates ?? c.rates.length) === 1) ? "" : "s"}
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-none"
                          onClick={() => {
                            setSelectedCourier(c.id);
                            openRateEdit();
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden /> Rate
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 rounded-none" onClick={() => openCourierEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-none text-destructive"
                          onClick={() => setCourierDelete(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          <span className="sr-only">Delete {c.name}</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Rates */}
          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionLabel>Shipping rates {selectedName ? `— ${selectedName}` : ""}</SectionLabel>
              <div className="flex items-center gap-2">
                <Select value={selectedCourier} onValueChange={setSelectedCourier}>
                  <SelectTrigger className="h-9 w-56 rounded-none" aria-label="Select courier">
                    <SelectValue placeholder="Select courier" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {couriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  disabled={!selectedCourier}
                  onClick={() => openRateEdit()}
                >
                  <Plus className="h-4 w-4" aria-hidden /> New rate
                </Button>
              </div>
            </div>

            <div className="border border-border bg-card">
              {!selectedCourier ? (
                <EmptyState
                  title="Select a courier"
                  hint="Pick a courier above to manage its shipping rates."
                />
              ) : ratesLoading ? (
                <TableSkeleton rows={3} cols={5} />
              ) : rates.length === 0 ? (
                <EmptyState
                  title="No rates for this courier"
                  hint="Add a flat or region-based rate so checkout can price shipping."
                  action={
                    <Button variant="outline" className="rounded-none" onClick={() => openRateEdit()}>
                      Add rate
                    </Button>
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Rate</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Free above</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="pl-4 font-medium">{r.name}</TableCell>
                        <TableCell>
                          <SimpleBadge tone={r.type === "FLAT" ? "neutral" : "bronze"}>{r.type}</SimpleBadge>
                        </TableCell>
                        <TableCell className="text-sm">{r.region || "*"}</TableCell>
                        <TableCell>
                          <Money cents={r.rateCents} />
                        </TableCell>
                        <TableCell>
                          {r.freeAboveCents !== null ? <Money cents={r.freeAboveCents} /> : "—"}
                        </TableCell>
                        <TableCell>
                          <SimpleBadge tone={r.isActive ? "green" : "neutral"}>
                            {r.isActive ? "Active" : "Inactive"}
                          </SimpleBadge>
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button variant="outline" size="sm" className="h-8 rounded-none" onClick={() => openRateEdit(r)}>
                              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-none text-destructive"
                              onClick={() => setRateDelete(r)}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              <span className="sr-only">Delete {r.name}</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            {selectedCourier && rates.length === 0 && !ratesLoading ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <PackageOpen className="h-3.5 w-3.5" aria-hidden /> Checkout hides couriers without active rates.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Courier dialog */}
      <Dialog open={courierDialog} onOpenChange={setCourierDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {courierForm.id ? "Edit courier" : "New courier"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="k-name" className="text-[13px] font-light">Name</Label>
                <Input
                  id="k-name"
                  value={courierForm.name}
                  onChange={(e) => setCourierForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="Nusantara Express"
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="k-code" className="text-[13px] font-light">Code</Label>
                <Input
                  id="k-code"
                  value={courierForm.code}
                  onChange={(e) => setCourierForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="mt-1.5 h-10 rounded-none font-mono text-[13px]"
                  placeholder="NUSEX"
                  maxLength={24}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="k-desc" className="text-[13px] font-light">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="k-desc"
                value={courierForm.description}
                onChange={(e) => setCourierForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1.5 h-10 rounded-none"
                maxLength={400}
              />
            </div>
            <div>
              <Label htmlFor="k-track" className="text-[13px] font-light">
                Tracking URL template <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="k-track"
                value={courierForm.trackingUrlTemplate}
                onChange={(e) => setCourierForm((f) => ({ ...f, trackingUrlTemplate: e.target.value }))}
                className="mt-1.5 h-10 rounded-none font-mono text-xs"
                placeholder="https://example.com/track?no={trackingNumber}"
                maxLength={300}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Must include <code className="font-mono">{"{trackingNumber}"}</code> — it is replaced with the
                real number for customers.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="k-min" className="text-[13px] font-light">Min days</Label>
                <Input
                  id="k-min"
                  type="number"
                  min={0}
                  max={90}
                  value={courierForm.minDays}
                  onChange={(e) => setCourierForm((f) => ({ ...f, minDays: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                />
              </div>
              <div>
                <Label htmlFor="k-max" className="text-[13px] font-light">Max days</Label>
                <Input
                  id="k-max"
                  type="number"
                  min={0}
                  max={90}
                  value={courierForm.maxDays}
                  onChange={(e) => setCourierForm((f) => ({ ...f, maxDays: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                />
              </div>
              <div>
                <Label htmlFor="k-pos" className="text-[13px] font-light">Position</Label>
                <Input
                  id="k-pos"
                  type="number"
                  min={0}
                  max={99}
                  value={courierForm.position}
                  onChange={(e) => setCourierForm((f) => ({ ...f, position: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="k-active"
                checked={courierForm.isActive}
                onCheckedChange={(v) => setCourierForm((f) => ({ ...f, isActive: v }))}
              />
              <Label htmlFor="k-active" className="text-sm">Active — offered at checkout</Label>
            </div>
          </div>
          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" className="rounded-none" onClick={() => setCourierDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveCourier()} disabled={savingCourier} className="rounded-none">
              {savingCourier ? <InlineSpinner /> : courierForm.id ? "Save changes" : "Create courier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate dialog */}
      <Dialog open={rateDialog} onOpenChange={setRateDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{rateForm.id ? "Edit rate" : "New rate"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-[13px] font-light">Courier</Label>
              <Select value={rateForm.courierId} onValueChange={(v) => setRateForm((f) => ({ ...f, courierId: v }))}>
                <SelectTrigger className="mt-1.5 h-10 rounded-none" aria-label="Courier">
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {couriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="r-name" className="text-[13px] font-light">Rate name</Label>
                <Input
                  id="r-name"
                  value={rateForm.name}
                  onChange={(e) => setRateForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="Reguler"
                  maxLength={80}
                />
              </div>
              <div>
                <Label className="text-[13px] font-light">Type</Label>
                <Select
                  value={rateForm.type}
                  onValueChange={(v) => setRateForm((f) => ({ ...f, type: v as "FLAT" | "REGION" }))}
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-none" aria-label="Rate type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="FLAT">Flat — same everywhere</SelectItem>
                    <SelectItem value="REGION">Region — per province</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {rateForm.type === "REGION" ? (
              <div>
                <Label htmlFor="r-region" className="text-[13px] font-light">Region</Label>
                <Input
                  id="r-region"
                  value={rateForm.region}
                  onChange={(e) => setRateForm((f) => ({ ...f, region: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="Jakarta (or * for any)"
                  maxLength={80}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Matches the customer&apos;s province name. Use * as a fallback for any region.
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="r-rate" className="text-[13px] font-light">Cost</Label>
                <Input
                  id="r-rate"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="numeric"
                  value={rateForm.rate}
                  onChange={(e) => setRateForm((f) => ({ ...f, rate: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="25000"
                />
                <p className="mt-1 text-xs text-muted-foreground">Whole currency units — stored as cents.</p>
              </div>
              <div>
                <Label htmlFor="r-free" className="text-[13px] font-light">
                  Free above <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="r-free"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="numeric"
                  value={rateForm.freeAbove}
                  onChange={(e) => setRateForm((f) => ({ ...f, freeAbove: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="1000000"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="r-active"
                checked={rateForm.isActive}
                onCheckedChange={(v) => setRateForm((f) => ({ ...f, isActive: v }))}
              />
              <Label htmlFor="r-active" className="text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" className="rounded-none" onClick={() => setRateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveRate()} disabled={savingRate} className="rounded-none">
              {savingRate ? <InlineSpinner /> : rateForm.id ? "Save changes" : "Create rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Courier delete confirm */}
      <AlertDialog open={courierDelete !== null} onOpenChange={(open) => !open && setCourierDelete(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete courier?</AlertDialogTitle>
            <AlertDialogDescription>
              “{courierDelete?.name}” will be removed. If any past shipments used this courier it is merely
              deactivated instead, so history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none"
              onClick={(e) => {
                e.preventDefault();
                void removeCourier();
              }}
            >
              {deletingCourier ? <InlineSpinner /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rate delete confirm */}
      <AlertDialog open={rateDelete !== null} onOpenChange={(open) => !open && setRateDelete(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete rate?</AlertDialogTitle>
            <AlertDialogDescription>
              “{rateDelete?.name}” will no longer be offered for {rateDelete?.courier?.name ?? "this courier"} at
              checkout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none"
              onClick={(e) => {
                e.preventDefault();
                void removeRate();
              }}
            >
              {deletingRate ? <InlineSpinner /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
