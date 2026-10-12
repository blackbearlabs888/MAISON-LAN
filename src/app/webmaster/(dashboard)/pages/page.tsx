"use client";

// CMS pages — table of content pages with links to the shared PageEditor.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, FilePlus2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, fmtDateTime, type ContentPage } from "@/lib/webmaster-client";
import { Button } from "@/components/ui/button";
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
  EmptyState,
  ErrorState,
  PageHeader,
  Pager,
  SimpleBadge,
  TableSkeleton,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";
const VIEW_PAGE_SIZE = 10;

export default function CmsPagesListPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ContentPage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await apiGet<{ pages: ContentPage[] }>("/api/webmaster/pages");
      setPages(res.pages);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pages.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/webmaster/pages/${deleteTarget.id}`);
      toast.success(`“${deleteTarget.title}” deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  const total = pages.length;
  const start = (page - 1) * VIEW_PAGE_SIZE;
  const visible = pages.slice(start, start + VIEW_PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="CMS Pages"
        description="About, Terms, Privacy — markdown pages rendered on the storefront."
        actions={
          <Button asChild className="rounded-none">
            <Link href="/webmaster/pages/new">
              <FilePlus2 className="h-4 w-4" aria-hidden /> New page
            </Link>
          </Button>
        }
      />

      <div className="border border-border bg-card">
        {phase === "loading" ? (
          <TableSkeleton rows={4} cols={5} />
        ) : phase === "error" ? (
          <ErrorState message={error ?? "Failed to load pages."} onRetry={() => void load()} />
        ) : pages.length === 0 ? (
          <EmptyState
            title="No pages yet"
            hint="Create your About, Shipping Policy or Terms pages here."
            action={
              <Button asChild variant="outline" className="rounded-none">
                <Link href="/webmaster/pages/new">New page</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Footer link</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 font-medium">{p.title}</TableCell>
                    <TableCell className="font-mono text-xs">/pages/{p.slug}</TableCell>
                    <TableCell>
                      <SimpleBadge tone={p.isPublished ? "green" : "amber"}>
                        {p.isPublished ? "Published" : "Draft"}
                      </SimpleBadge>
                    </TableCell>
                    <TableCell>
                      <SimpleBadge tone={p.showInFooter ? "neutral" : "neutral"}>
                        {p.showInFooter ? "Shown" : "Hidden"}
                      </SimpleBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(p.updatedAt)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button asChild variant="outline" size="sm" className="h-8 rounded-none">
                          <Link href={`/webmaster/pages/${p.id}/edit`}>Edit</Link>
                        </Button>
                        {p.isPublished ? (
                          <Button asChild variant="ghost" size="sm" className="h-8 rounded-none text-muted-foreground">
                            <Link href={`/pages/${p.slug}`} target="_blank">
                              <Eye className="h-3.5 w-3.5" aria-hidden /> View
                            </Link>
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-none text-destructive"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          <span className="sr-only">Delete {p.title}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} pageSize={VIEW_PAGE_SIZE} total={total} onPage={(p) => setPage(p)} />
          </>
        )}
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” (/pages/{deleteTarget?.slug}) will be removed permanently. Links to it
              from the storefront footer will disappear.
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
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
