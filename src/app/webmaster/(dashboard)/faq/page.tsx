"use client";

// FAQ — scrollable list with inline create/edit dialog + delete.

import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  fmtDate,
  type FaqEntry,
  type FaqPayload,
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
  EmptyState,
  ErrorState,
  InlineSpinner,
  PageHeader,
  SectionLabel,
  SimpleBadge,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";

interface FormState {
  id: string | null;
  question: string;
  answer: string;
  position: string;
  isActive: boolean;
}

const EMPTY: FormState = { id: null, question: "", answer: "", position: "0", isActive: true };

export default function FaqPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<FaqEntry[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FaqEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await apiGet<{ entries: FaqEntry[] }>("/api/webmaster/faq");
      setEntries(res.entries);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load FAQ.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm({ ...EMPTY, position: String(entries.length) });
    setDialogOpen(true);
  }

  function openEdit(e: FaqEntry) {
    setForm({
      id: e.id,
      question: e.question,
      answer: e.answer,
      position: String(e.position),
      isActive: e.isActive,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (form.question.trim().length < 4) return toast.error("The question is too short.");
    if (form.answer.trim().length < 2) return toast.error("The answer is too short.");
    const payload: FaqPayload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      position: Math.max(0, Math.round(Number(form.position) || 0)),
      isActive: form.isActive,
    };
    setSaving(true);
    try {
      if (form.id) {
        await apiPut(`/api/webmaster/faq/${form.id}`, payload);
        toast.success("FAQ entry updated.");
      } else {
        await apiPost("/api/webmaster/faq", payload);
        toast.success("FAQ entry created.");
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
      await apiDelete(`/api/webmaster/faq/${deleteTarget.id}`);
      toast.success("FAQ entry deleted.");
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
        title="FAQ"
        description="Customer-facing questions shown in the storefront help section."
        actions={
          <Button onClick={openCreate} className="rounded-none">
            <FilePlus2 className="h-4 w-4" aria-hidden /> New entry
          </Button>
        }
      />

      {phase === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <InlineSpinner /> Loading FAQ…
        </div>
      ) : phase === "error" ? (
        <ErrorState message={error ?? "Failed to load FAQ."} onRetry={() => void load()} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No FAQ entries yet"
          hint="Answer shipping, returns and care questions before customers ask."
          action={
            <Button variant="outline" className="rounded-none" onClick={openCreate}>
              Create the first entry
            </Button>
          }
        />
      ) : (
        <div className="scroll-slim max-h-96 space-y-2 overflow-y-auto pr-1">
          {entries.map((e) => (
            <div key={e.id} className="border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{e.question}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.answer}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>#{e.position}</span>
                    <span>·</span>
                    <span>Updated {fmtDate(e.updatedAt)}</span>
                    {!e.isActive ? <SimpleBadge tone="amber">Hidden</SimpleBadge> : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 rounded-none" onClick={() => openEdit(e)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-none text-destructive"
                    onClick={() => setDeleteTarget(e)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Delete entry</span>
                  </Button>
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
            <DialogTitle className="font-display">{form.id ? "Edit entry" : "New FAQ entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="q-question" className="text-[13px] font-light">Question</Label>
              <Input
                id="q-question"
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                className="mt-1.5 h-10 rounded-none"
                placeholder="How long does shipping take?"
                maxLength={300}
              />
            </div>
            <div>
              <Label htmlFor="q-answer" className="text-[13px] font-light">Answer</Label>
              <Textarea
                id="q-answer"
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                className="mt-1.5 min-h-32 rounded-none"
                placeholder="Orders ship within 1–2 business days…"
                maxLength={3000}
              />
            </div>
            <div className="flex items-end justify-between gap-4">
              <div className="w-32">
                <Label htmlFor="q-pos" className="text-[13px] font-light">Position</Label>
                <Input
                  id="q-pos"
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
                  id="q-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <Label htmlFor="q-active" className="text-sm">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" className="rounded-none" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving} className="rounded-none">
              {saving ? <InlineSpinner /> : form.id ? "Save changes" : "Create entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete FAQ entry?</AlertDialogTitle>
            <AlertDialogDescription>“{deleteTarget?.question}” will be removed.</AlertDialogDescription>
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

      <div className="mt-6">
        <SectionLabel>Active entries appear in storefront order</SectionLabel>
      </div>
    </div>
  );
}
