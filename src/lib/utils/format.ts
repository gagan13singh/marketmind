/** Display formatting helpers. All tolerate null so callers stay clean. */

export function formatPrice(value: number | null, currency = "₹"): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${currency}${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(value: number | null, digits = 2, showSign = true): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/**
 * Indian numbering for large figures: lakh (1e5) and crore (1e7).
 * Financial statements in India are read in crores, not millions.
 */
export function formatIndianCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 2 })} L`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a date deterministically from its UTC components.
 *
 * Deliberately NOT `toLocaleDateString`: that formats in the runtime's local
 * timezone, so a date rendered on a UTC server and re-rendered in an IST or
 * US browser can disagree by a day. React reports that as a hydration
 * mismatch. Reading UTC parts directly gives the same string everywhere.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Short form for badges: `13 Aug`. Same timezone-safety reasoning as above. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function directionClass(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) return "flat";
  return value > 0 ? "bull" : "bear";
}
