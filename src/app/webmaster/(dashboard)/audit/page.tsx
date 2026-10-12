"use client";

// Audit log — last 100 sensitive admin actions.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet, fmtDateTime, truncate, type AuditLog } from "@/lib/webmaster-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SimpleBadge,
  TableSkeleton,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";

function actionTone(action: string): "red" | "amber" | "green" | "neutral" | "bronze" {
  if (action.includes("DELETE")) return "red";
  if (action.includes("CANCEL") || action.includes("DISABLE") || action.includes("ARCHIVE")) return "amber";
  if (action.includes("CREATE") || action.includes("BOOTSTRAP")) return "green";
  if (action.includes("UPDATE") || action.includes("CHANGE") || action.includes("CONFIRM")) return "bronze";
  return "neutral";
}

export default function AuditPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // State updates happen in promise callbacks — never synchronously in the effect.
  useEffect(() => {
    let cancelled = false;
    apiGet<{ logs: AuditLog[] }>("/api/webmaster/audit")
      .then((res) => {
        if (cancelled) return;
        setLogs(res.logs);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load audit log.");
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

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Last 100 sensitive staff actions — who changed what, and when."
        actions={
          <Button variant="outline" size="sm" className="rounded-none" onClick={refresh}>
            Refresh
          </Button>
        }
      />

      <div className="border border-border bg-card">
        {phase === "loading" ? (
          <TableSkeleton rows={8} cols={5} />
        ) : phase === "error" ? (
          <ErrorState message={error ?? "Failed to load audit log."} onRetry={refresh} />
        ) : logs.length === 0 ? (
          <EmptyState title="No audit entries yet" hint="Staff actions will appear here automatically." />
        ) : (
          <div className="scroll-slim max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 bg-card hover:bg-transparent">
                  <TableHead className="pl-4">Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="pr-4">Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  let metaPretty = "";
                  if (log.meta) {
                    try {
                      metaPretty = JSON.stringify(JSON.parse(log.meta));
                    } catch {
                      metaPretty = log.meta;
                    }
                  }
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap pl-4 text-xs text-muted-foreground">
                        {fmtDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-44 truncate text-xs">{log.actorEmail ?? "system"}</TableCell>
                      <TableCell>
                        <SimpleBadge tone={actionTone(log.action)}>
                          <span className="font-mono text-[11px]">{log.action}</span>
                        </SimpleBadge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.entity ? (
                          <span>
                            {log.entity}
                            {log.entityId ? <span className="text-muted-foreground"> · {log.entityId.slice(0, 10)}…</span> : null}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-72 truncate pr-4 font-mono text-[11px] text-muted-foreground"
                        title={metaPretty || undefined}
                      >
                        {metaPretty ? truncate(metaPretty, 70) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {phase === "ready" && logs.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing the most recent {logs.length} entries. Older entries remain in the database.
        </p>
      ) : null}
    </div>
  );
}
