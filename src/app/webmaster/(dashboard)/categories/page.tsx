"use client";

// Categories — table + create/edit dialog + delete confirm.

import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  slugify,
  type Category,
  type CategoryPayload,
} from "@/lib/webmaster-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  ImageUrlField,
  InlineSpinner,
  PageHeader,
  SimpleBadge,
  TableSkeleton,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";

interface FormState {
  id: string | null;
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  imageUrl: string;
  position: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  id: null,
  name: "",
  slug: "",
  slugTouched: false,
  description: "",
  imageUrl: "",
  position: "0",
  isActive: true,
};

export default function CategoriesPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await apiGet<{ categories: Category[] }>("/api/webmaster/categories");
      setCategories(res.categories);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(c: Category) {
    setForm({
      id: c.id,
      name: c.name,
      slug: c.slug,
      slugTouched: true,
      description: c.description ?? "",
      imageUrl: c.imageUrl ?? "",
      position: String(c.position),
      isActive: c.isActive,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (form.name.trim().length < 2) {
      toast.error("Category name is too short.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      toast.error("Slug must be lowercase kebab-case (e.g. handbags).");
      return;
    }
    const payload: CategoryPayload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      position: Math.max(0, Math.round(Number(form.position) || 0)),
      isActive: form.isActive,
    };
    setSaving(true);
    try {
      if (form.id) {
        await apiPut(`/api/webmaster/categories/${form.id}`, payload);
        toast.success("Category updated.");
      } else {
        await apiPost("/api/webmaster/categories", payload);
        toast.success("Category created.");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/webmaster/categories/${deleteTarget.id}`);
      toast.success(`“${deleteTarget.name}” deleted.`);
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
        title="Categories"
        description="Storefront collections — handbags, jewelry, apparel…"
        actions={
          <Button onClick={openCreate} className="rounded-none">
            <FilePlus2 className="h-4 w-4" aria-hidden /> New category
          </Button>
        }
      />

      <div className="border border-border bg-card">
        {phase === "loading" ? (
          <TableSkeleton rows={4} cols={5} />
        ) : phase === "error" ? (
          <ErrorState message={error ?? "Failed to load categories."} onRetry={() => void load()} />
        ) : categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            hint="Categories power the storefront navigation and collection pages."
            action={
              <Button variant="outline" onClick={openCreate} className="rounded-none">
                Create the first category
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Category</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt={c.name} className="h-10 w-10 border border-border object-cover" />
                      ) : (
                        <div className="h-10 w-10 border border-dashed border-border bg-muted" aria-hidden />
                      )}
                      <div>
                        <p className="font-medium">{c.name}</p>
                        {c.description ? (
                          <p className="max-w-64 truncate text-xs text-muted-foreground">{c.description}</p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">/{c.slug}</TableCell>
                  <TableCell>{c._count?.products ?? 0}</TableCell>
                  <TableCell>{c.position}</TableCell>
                  <TableCell>
                    <SimpleBadge tone={c.isActive ? "green" : "neutral"}>
                      {c.isActive ? "Active" : "Hidden"}
                    </SimpleBadge>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" className="h-8 rounded-none" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-none text-destructive"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">Delete {c.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{form.id ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="c-name" className="text-[13px] font-light">Name</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: f.slugTouched ? f.slug : slugify(e.target.value),
                  }))
                }
                className="mt-1.5 h-10 rounded-none"
                placeholder="Handbags"
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="c-slug" className="text-[13px] font-light">Slug</Label>
              <Input
                id="c-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value, slugTouched: true }))}
                className="mt-1.5 h-10 rounded-none font-mono text-[13px]"
                placeholder="handbags"
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="c-desc" className="text-[13px] font-light">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="c-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1.5 min-h-20 rounded-none"
                maxLength={600}
              />
            </div>
            <ImageUrlField
              label="Image (optional)"
              value={form.imageUrl}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
            />
            <div className="flex items-end justify-between gap-4">
              <div className="w-32">
                <Label htmlFor="c-pos" className="text-[13px] font-light">Position</Label>
                <Input
                  id="c-pos"
                  type="number"
                  min={0}
                  max={999}
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  className="mt-1.5 h-10 rounded-none"
                />
              </div>
              <div className="flex items-center gap-2 pb-2.5">
                <Switch
                  id="c-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <Label htmlFor="c-active" className="text-sm">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" className="rounded-none" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving} className="rounded-none">
              {saving ? <InlineSpinner /> : form.id ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” will be removed from the storefront. Product links to this category
              are cleaned up automatically; the products themselves are kept.
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
