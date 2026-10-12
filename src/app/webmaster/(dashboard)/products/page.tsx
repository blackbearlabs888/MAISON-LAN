"use client";

// Products — searchable list with Active/Archived/All tabs, archive and
// hard-delete actions. Editing happens in the shared ProductEditor page.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, FilePlus2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  fmtDate,
  type ProductListResponse,
} from "@/lib/webmaster-client";
import { useStoreConfig } from "@/lib/store-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  SmartImage,
  TableSkeleton,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";
type Tab = "active" | "archived" | "all";

interface PendingAction {
  id: string;
  name: string;
  hard: boolean;
}

export default function ProductsListPage() {
  const { format } = useStoreConfig();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProductListResponse | null>(null);

  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [working, setWorking] = useState(false);

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
      const params = new URLSearchParams({ status: tab, page: String(page) });
      if (debounced) params.set("q", debounced);
      const res = await apiGet<ProductListResponse>(`/api/webmaster/products?${params.toString()}`);
      setData(res);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products.");
      setPhase("error");
    }
  }, [tab, debounced, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runPending() {
    if (!pending) return;
    setWorking(true);
    try {
      const res = await apiDelete<{ archived?: boolean; deleted?: boolean }>(
        `/api/webmaster/products/${pending.id}${pending.hard ? "?hard=true" : ""}`
      );
      if (res.deleted) toast.success(`“${pending.name}” deleted permanently.`);
      else toast.success(`“${pending.name}” archived.`);
      setPending(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Catalog, pricing, variants and stock."
        actions={
          <Button asChild className="rounded-none">
            <Link href="/webmaster/products/new">
              <FilePlus2 className="h-4 w-4" aria-hidden /> New product
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setPage(1); }}>
          <TabsList className="rounded-none bg-secondary">
            <TabsTrigger value="active" className="rounded-none">Active</TabsTrigger>
            <TabsTrigger value="archived" className="rounded-none">Archived</TabsTrigger>
            <TabsTrigger value="all" className="rounded-none">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, SKU or slug…"
            className="h-10 rounded-none pl-9"
            aria-label="Search products"
          />
        </div>
      </div>

      <div className="border border-border bg-card">
        {phase === "loading" ? (
          <TableSkeleton rows={6} cols={6} />
        ) : phase === "error" ? (
          <ErrorState message={error ?? "Failed to load products."} onRetry={() => void load()} />
        ) : !data || data.products.length === 0 ? (
          <EmptyState
            title="No products here yet"
            hint="Create your first piece — handbags, jewelry, apparel and more."
            action={
              <Button asChild variant="outline" className="rounded-none">
                <Link href="/webmaster/products/new">New product</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <SmartImage
                          src={p.image}
                          alt={p.name}
                          className="h-12 w-12 shrink-0"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/webmaster/products/${p.id}/edit`}
                            className="block max-w-56 truncate font-medium hover:text-[#7d6134]"
                          >
                            {p.name}
                          </Link>
                          <p className="max-w-56 truncate text-xs text-muted-foreground">/{p.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{p.skuBase}</TableCell>
                    <TableCell>
                      {p.salePriceCents !== null ? (
                        <span>
                          <span className="text-[#7d6134]">{format(p.salePriceCents)}</span>{" "}
                          <span className="text-xs text-muted-foreground line-through">
                            {format(p.priceCents)}
                          </span>
                        </span>
                      ) : (
                        format(p.priceCents)
                      )}
                    </TableCell>
                    <TableCell>
                      <SimpleBadge tone={p.totalStock <= 5 ? "red" : p.totalStock <= 15 ? "amber" : "neutral"}>
                        {p.totalStock} in stock
                      </SimpleBadge>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.variantCount} variant{p.variantCount === 1 ? "" : "s"}</p>
                    </TableCell>
                    <TableCell>
                      {p.categories.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <p className="max-w-40 truncate text-xs">{p.categories.join(", ")}</p>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!p.archivedAt ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-none"
                            onClick={() => setPending({ id: p.id, name: p.name, hard: false })}
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden /> Archive
                          </Button>
                        ) : (
                          <>
                            <span className="mr-1 text-xs text-muted-foreground">
                              Archived {fmtDate(p.archivedAt)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-none"
                              onClick={() => setPending({ id: p.id, name: p.name, hard: true })}
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Delete forever
                            </Button>
                          </>
                        )}
                        <Button asChild variant="outline" size="sm" className="h-8 rounded-none">
                          <Link href={`/webmaster/products/${p.id}/edit`}>Edit</Link>
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

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {pending?.hard ? "Delete permanently?" : "Archive product?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.hard
                ? `“${pending?.name}” will be removed for good if it has never been ordered; otherwise it stays archived. This cannot be undone.`
                : `“${pending?.name}” will be hidden from the storefront and marked archived. Order history is preserved.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none"
              onClick={(e) => {
                e.preventDefault();
                void runPending();
              }}
            >
              {working ? "Working…" : pending?.hard ? "Delete" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
