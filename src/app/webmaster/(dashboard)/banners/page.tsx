"use client";

// Banners — hero cards grid with quick active toggle, edit dialog + delete.

import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  type Banner,
  type BannerPayload,
} from "@/lib/webmaster-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  CardsSkeleton,
  EmptyState,
  ErrorState,
  ImageUrlField,
  InlineSpinner,
  PageHeader,
  SimpleBadge,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";

interface FormState {
  id: string | null;
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl: string;
  ctaText: string;
  ctaUrl: string;
  position: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  id: null,
  title: "",
  subtitle: "",
  imageUrl: "",
  mobileImageUrl: "",
  ctaText: "",
  ctaUrl: "",
  position: "0",
  isActive: true,
};

export default function BannersPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await apiGet<{ banners: Banner[] }>("/api/webmaster/banners");
      setBanners(res.banners);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load banners.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm({ ...EMPTY, position: String(banners.length) });
    setDialogOpen(true);
  }

  function openEdit(b: Banner) {
    setForm({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? "",
      imageUrl: b.imageUrl,
      mobileImageUrl: b.mobileImageUrl ?? "",
      ctaText: b.ctaText ?? "",
      ctaUrl: b.ctaUrl ?? "",
      position: String(b.position),
      isActive: b.isActive,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (form.title.trim().length < 2) return toast.error("Banner title is too short.");
    if (!form.imageUrl.trim()) return toast.error("A banner image is required.");
    const payload: BannerPayload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      imageUrl: form.imageUrl.trim(),
      mobileImageUrl: form.mobileImageUrl.trim() || undefined,
      ctaText: form.ctaText.trim() || undefined,
      ctaUrl: form.ctaUrl.trim() || undefined,
      position: Math.max(0, Math.round(Number(form.position) || 0)),
      isActive: form.isActive,
    };
    setSaving(true);
    try {
      if (form.id) {
        await apiPut(`/api/webmaster/banners/${form.id}`, payload);
        toast.success("Banner updated.");
      } else {
        await apiPost("/api/webmaster/banners", payload);
        toast.success("Banner created.");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function quickToggle(b: Banner, next: boolean) {
    setTogglingId(b.id);
    try {
      await apiPut(`/api/webmaster/banners/${b.id}`, {
        title: b.title,
        subtitle: b.subtitle ?? undefined,
        imageUrl: b.imageUrl,
        mobileImageUrl: b.mobileImageUrl ?? undefined,
        ctaText: b.ctaText ?? undefined,
        ctaUrl: b.ctaUrl ?? undefined,
        position: b.position,
        isActive: next,
      });
      toast.success(next ? "Banner activated." : "Banner hidden.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update banner.");
    } finally {
      setTogglingId(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/webmaster/banners/${deleteTarget.id}`);
      toast.success(`“${deleteTarget.title}” deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Banners"
        description="Hero and editorial imagery shown on the homepage."
        actions={
          <Button onClick={openCreate} className="rounded-none">
            <FilePlus2 className="h-4 w-4" aria-hidden /> New banner
          </Button>
        }
      />

      {phase === "loading" ? (
        <CardsSkeleton count={3} />
      ) : phase === "error" ? (
        <ErrorState message={error ?? "Failed to load banners."} onRetry={() => void load()} />
      ) : banners.length === 0 ? (
        <EmptyState
          title="No banners yet"
          hint="Hero banners appear at the top of the homepage carousel."
          action={
            <Button variant="outline" className="rounded-none" onClick={openCreate}>
              Create the first banner
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {banners.map((b) => (
            <div key={b.id} className="border border-border bg-card">
              <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border bg-muted">
                {b.imageUrl ? (
                  <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover" />
                ) : null}
                {!b.isActive ? (
                  <span className="absolute left-2 top-2">
                    <SimpleBadge tone="neutral">Hidden</SimpleBadge>
                  </span>
                ) : null}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.title}</p>
                    {b.subtitle ? (
                      <p className="truncate text-xs text-muted-foreground">{b.subtitle}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">#{b.position}</span>
                </div>
                {b.ctaText || b.ctaUrl ? (
                  <p className="truncate text-xs text-muted-foreground">
                    CTA: {b.ctaText || "—"} → {b.ctaUrl || "—"}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={b.isActive}
                      disabled={togglingId === b.id}
                      onCheckedChange={(v) => void quickToggle(b, v)}
                      aria-label={`Toggle ${b.title}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {togglingId === b.id ? "Saving…" : b.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 rounded-none" onClick={() => openEdit(b)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-none text-destructive"
                      onClick={() => setDeleteTarget(b)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">Delete {b.title}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{form.id ? "Edit banner" : "New banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="b-title" className="text-[13px] font-light">Title</Label>
              <Input
                id="b-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1.5 h-10 rounded-none"
                placeholder="The Autumn Atelier"
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="b-sub" className="text-[13px] font-light">
                Subtitle <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="b-sub"
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                className="mt-1.5 h-10 rounded-none"
                maxLength={240}
              />
            </div>
            <ImageUrlField
              label="Desktop image"
              value={form.imageUrl}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
            />
            <ImageUrlField
              label="Mobile image (optional)"
              value={form.mobileImageUrl}
              onChange={(url) => setForm((f) => ({ ...f, mobileImageUrl: url }))}
              compact
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="b-cta-text" className="text-[13px] font-light">CTA text</Label>
                <Input
                  id="b-cta-text"
                  value={form.ctaText}
                  onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="Discover the collection"
                  maxLength={60}
                />
              </div>
              <div>
                <Label htmlFor="b-cta-url" className="text-[13px] font-light">CTA URL</Label>
                <Input
                  id="b-cta-url"
                  value={form.ctaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none font-mono text-xs"
                  placeholder="/collections/apparel"
                  maxLength={300}
                />
              </div>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div className="w-32">
                <Label htmlFor="b-pos" className="text-[13px] font-light">Position</Label>
                <Input
                  id="b-pos"
                  type="number"
                  min={0}
                  max={99}
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                />
              </div>
              <div className="flex items-center gap-2 pb-2.5">
                <Switch
                  id="b-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <Label htmlFor="b-active" className="text-sm">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" className="rounded-none" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving} className="rounded-none">
              {saving ? <InlineSpinner /> : form.id ? "Save changes" : "Create banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete banner?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” will be removed from the homepage immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none"
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {deleting ? <InlineSpinner /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
