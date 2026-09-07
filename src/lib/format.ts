const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function money(value: number): string {
  return usd.format(value);
}

export function moneyCompact(value: number): string {
  return usdCompact.format(value);
}

export function percent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

export function quantity(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** Coarse, human relative time. Precise enough for an expiry, cheap to read. */
export function untilLabel(timestamp: number): string {
  const delta = timestamp - Date.now();
  if (delta <= 0) return "expired";

  const minutes = Math.round(delta / 60_000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

export function dateLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Local-time value for a datetime-local input. */
export function toDateTimeLocal(timestamp: number): string {
  const d = new Date(timestamp - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}
