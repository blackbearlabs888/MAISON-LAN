"use client";

// Shared presentational bits for the webmaster dashboard —
// page headers, status badges, loading/empty/error states, pagination,
// money rendering, and the image upload widget.

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useStoreConfig } from "@/lib/store-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { uploadImage, type OrderStatus, type PaymentStatus, type ShipmentStatus } from "@/lib/webmaster-client";
import { cn } from "@/lib/utils";

// ───────────────────────── layout ─────────────────────────

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("editorial-label text-muted-foreground", className)}>{children}</p>;
}

// ───────────────────────── money ─────────────────────────

export function useMoney() {
  const { format } = useStoreConfig();
  return format;
}

export function Money({ cents, className }: { cents: number; className?: string }) {
  const format = useMoney();
  return <span className={className}>{format(cents)}</span>;
}

// ───────────────────────── status badges ─────────────────────────

const BADGE_TONES = {
  amber: "border-amber-300 bg-amber-50 text-amber-800",
  bronze: "border-[#c9b28a] bg-[#f4ede1] text-[#7d6134]",
  neutral: "border-stone-300 bg-stone-100 text-stone-700",
  green: "border-emerald-300 bg-emerald-50 text-emerald-800",
  red: "border-red-300 bg-red-50 text-red-800",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

function ToneBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-normal", BADGE_TONES[tone])}>
      {children}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone: BadgeTone =
    status === "PENDING_PAYMENT"
      ? "amber"
      : status === "PAID"
        ? "bronze"
        : status === "PROCESSING" || status === "READY_TO_SHIP"
          ? "neutral"
          : status === "SHIPPED" || status === "COMPLETED"
            ? "green"
            : "red"; // CANCELLED | REFUNDED
  const label: Record<OrderStatus, string> = {
    PENDING_PAYMENT: "Pending payment",
    PAID: "Paid",
    PROCESSING: "Processing",
    READY_TO_SHIP: "Ready to ship",
    SHIPPED: "Shipped",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
  };
  return <ToneBadge tone={tone}>{label[status] ?? status}</ToneBadge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone: BadgeTone = status === "PAID_CONFIRMED" ? "green" : status === "REFUNDED" ? "red" : "amber";
  const label: Record<PaymentStatus, string> = {
    UNPAID: "Unpaid",
    PAID_CONFIRMED: "Paid",
    REFUNDED: "Refunded",
  };
  return <ToneBadge tone={tone}>{label[status] ?? status}</ToneBadge>;
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const tone: BadgeTone =
    status === "DELIVERED"
      ? "green"
      : status === "IN_TRANSIT"
        ? "bronze"
        : status === "OUT_FOR_DELIVERY"
          ? "amber"
          : status === "EXCEPTION" || status === "RETURNED"
            ? "red"
            : "neutral";
  const label: Record<ShipmentStatus, string> = {
    PENDING: "Pending",
    IN_TRANSIT: "In transit",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Delivered",
    EXCEPTION: "Exception",
    RETURNED: "Returned",
  };
  return <ToneBadge tone={tone}>{label[status] ?? status}</ToneBadge>;
}

export function SimpleBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <ToneBadge tone={tone}>{children}</ToneBadge>;
}

// ───────────────────────── states ─────────────────────────

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      <p className="max-w-md text-sm text-destructive">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="rounded-none">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-border px-6 py-14 text-center">
      <p className="font-display text-lg">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full" />
      ))}
    </div>
  );
}

export function InlineSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden />;
}

// ───────────────────────── pagination ─────────────────────────

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {total} result{total === 1 ? "" : "s"} · page {page} of {pages}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8 rounded-none" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span className="sr-only">Previous page</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-none"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── images ─────────────────────────

/** Dashboard thumbnail — unoptimized next/image with graceful fallback. */
export function SmartImage({
  src,
  alt,
  className,
  fallbackClassName,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-border bg-muted text-muted-foreground",
          className,
          fallbackClassName
        )}
        aria-label={alt}
        role="img"
      >
        <ImageOff className="h-4 w-4" aria-hidden />
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden border border-border bg-muted", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes="96px"
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ───────────────────────── upload widget ─────────────────────────

/**
 * Image URL field with local upload. Shows a small preview when a URL is set.
 * The value is always a plain URL string (uploaded files are stored in the
 * database and served from /api/uploads/<id> — works on Vercel & SQLite alike).
 */
export function ImageUrlField({
  value,
  onChange,
  label,
  placeholder = "/images/… or upload",
  compact = false,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  compact?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <div className="flex items-start gap-2">
        <SmartImage
          src={value || null}
          alt="Preview"
          className={compact ? "h-12 w-12 shrink-0" : "h-20 w-20 shrink-0"}
        />
        <div className="flex-1 space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-9 rounded-none text-sm"
          />
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline">
            {uploading ? (
              <>
                <InlineSpinner /> Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" aria-hidden /> Upload image (≤4MB, JPG/PNG/WebP)
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
