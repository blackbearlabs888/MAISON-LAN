"use client";

// Telegram notifications — database-backed configuration (Bot Token + Chat ID,
// saved via this page), integration status, test send, counters, delivery log.

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Save, SendHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  fmtDateTime,
  truncate,
  type NotificationsResponse,
  type TelegramStatusResponse,
} from "@/lib/webmaster-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ErrorState,
  InlineSpinner,
  PageHeader,
  SectionLabel,
  SimpleBadge,
  TableSkeleton,
} from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";

export default function NotificationsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [sending, setSending] = useState(false);

  // config form
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const [s, d] = await Promise.all([
        apiGet<TelegramStatusResponse>("/api/webmaster/telegram/test"),
        apiGet<NotificationsResponse>("/api/webmaster/notifications"),
      ]);
      setStatus(s);
      setData(d);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await apiPut<TelegramStatusResponse>("/api/webmaster/telegram/config", {
        botToken, // empty string = keep current
        chatId,
      });
      setStatus(next);
      setBotToken("");
      setChatId("");
      toast.success("Telegram configuration saved to the database.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function clearConfig() {
    if (!window.confirm("Remove the stored Bot Token and Chat ID from the database?")) return;
    setClearing(true);
    try {
      const next = await apiDelete<TelegramStatusResponse>("/api/webmaster/telegram/config");
      setStatus(next);
      setBotToken("");
      setChatId("");
      toast.success("Stored Telegram credentials removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear the configuration.");
    } finally {
      setClearing(false);
    }
  }

  async function sendTest() {
    setSending(true);
    try {
      const res = await apiPost<{ ok: boolean; error?: string }>("/api/webmaster/telegram/test");
      if (res.ok) {
        toast.success("Test notification sent — check the Telegram chat.");
      } else {
        toast.error(res.error ?? "Telegram rejected the message.");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Telegram alerts for orders, payments, shipments and stock."
        actions={
          <Button onClick={() => void sendTest()} disabled={sending || (status ? !status.configured : false)} className="rounded-none">
            {sending ? (
              <>
                <InlineSpinner /> Sending…
              </>
            ) : (
              <>
                <SendHorizontal className="h-4 w-4" aria-hidden /> Send test notification
              </>
            )}
          </Button>
        }
      />

      {phase === "loading" ? (
        <TableSkeleton rows={4} cols={4} />
      ) : phase === "error" ? (
        <ErrorState message={error ?? "Failed to load notifications."} onRetry={() => void load()} />
      ) : status && data ? (
        <div className="space-y-6">
          {/* Configuration — stored in the database, editable here */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="editorial-label flex items-center gap-2 text-muted-foreground">
                <KeyRound className="h-4 w-4" aria-hidden /> Telegram configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1fr_260px]">
              <form onSubmit={saveConfig} className="max-w-xl space-y-4">
                <div>
                  <Label htmlFor="tg-token" className="text-[13px] font-light">Bot Token</Label>
                  <Input
                    id="tg-token"
                    type="password"
                    autoComplete="off"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder={status.tokenMasked ?? "123456789:AAE…from @BotFather"}
                    className="mt-1.5 h-11 rounded-none font-mono text-xs"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Leave empty to keep the stored token. Create a bot with @BotFather to get one.
                  </p>
                </div>
                <div>
                  <Label htmlFor="tg-chatid" className="text-[13px] font-light">Chat ID</Label>
                  <Input
                    id="tg-chatid"
                    autoComplete="off"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder={status.chatIdMasked ?? "123456789, -100… or @channel"}
                    className="mt-1.5 h-11 rounded-none font-mono text-xs"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Numeric chat id (negative for groups/channels) or @channelusername. Leave empty to keep the stored value.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving} className="rounded-none">
                    {saving ? (
                      <>
                        <InlineSpinner /> Saving…
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" aria-hidden /> Save to database
                      </>
                    )}
                  </Button>
                  {status.source === "database" && (
                    <Button type="button" variant="outline" onClick={() => void clearConfig()} disabled={clearing} className="rounded-none">
                      {clearing ? (
                        <InlineSpinner />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" aria-hidden /> Clear stored
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>

              <div className="space-y-4 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <div>
                  <SectionLabel>Status</SectionLabel>
                  <p className="mt-1.5">
                    <SimpleBadge tone={status.configured ? "green" : "red"}>
                      {status.configured ? "Configured" : "Not configured"}
                    </SimpleBadge>
                  </p>
                </div>
                <div>
                  <SectionLabel>Credential source</SectionLabel>
                  <p className="mt-1.5">
                    <SimpleBadge tone={status.source === "database" ? "green" : status.source === "env" ? "neutral" : "red"}>
                      {status.source === "database" ? "Database (this page)" : status.source === "env" ? "Environment fallback" : "None"}
                    </SimpleBadge>
                  </p>
                </div>
                <div>
                  <SectionLabel>Stored values (masked)</SectionLabel>
                  <p className="mt-1.5 font-mono text-xs">Token: {status.tokenMasked ?? "—"}</p>
                  <p className="font-mono text-xs">Chat: {status.chatIdMasked ?? "—"}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Secrets are written to the database and never sent back to the browser in full.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Counters */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-none border-border shadow-none">
              <CardContent className="p-5">
                <SectionLabel>Sent</SectionLabel>
                <p className="mt-2 font-display text-3xl">{data.counters.sent}</p>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border shadow-none">
              <CardContent className="p-5">
                <SectionLabel>Failed</SectionLabel>
                <p className="mt-2 font-display text-3xl">{data.counters.failed}</p>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border shadow-none">
              <CardContent className="p-5">
                <SectionLabel>Pending</SectionLabel>
                <p className="mt-2 font-display text-3xl">{data.counters.pending}</p>
              </CardContent>
            </Card>
          </div>

          {/* Delivery log */}
          <div>
            <SectionLabel className="mb-3">Delivery log (last 60)</SectionLabel>
            <div className="border border-border bg-card">
              {data.deliveries.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No notifications yet — place a test order or send a test message.
                </p>
              ) : (
                <div className="scroll-slim max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-4">Event</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead className="pr-4 text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.deliveries.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="pl-4 font-mono text-xs font-medium">{d.event}</TableCell>
                          <TableCell>
                            <SimpleBadge tone={d.status === "SENT" ? "green" : d.status === "FAILED" ? "red" : "neutral"}>
                              {d.status}
                            </SimpleBadge>
                          </TableCell>
                          <TableCell>{d.attempts}</TableCell>
                          <TableCell className="max-w-64 truncate text-xs text-muted-foreground" title={d.lastError ?? undefined}>
                            {d.lastError ? truncate(d.lastError, 60) : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {d.orderId ? `${d.orderId.slice(0, 10)}…` : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap pr-4 text-right text-xs text-muted-foreground">
                            {fmtDateTime(d.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
