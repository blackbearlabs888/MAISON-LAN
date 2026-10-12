// Money utilities — all amounts are integer minor units (cents) per DECISIONS D-02.

export function formatMoney(cents: number, currency = "IDR", locale = "id-ID"): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "IDR" ? 0 : 2,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function parseMoneyToCents(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function effectiveUnitPriceCents(product: {
  priceCents: number;
  salePriceCents: number | null;
}): number {
  return product.salePriceCents != null && product.salePriceCents < product.priceCents
    ? product.salePriceCents
    : product.priceCents;
}
