/**
 * Client-safe symbol helpers.
 *
 * The full NSE universe (~3,150 names, ~120 KB) lives in `./nse-universe` and
 * is server-only. Client components import from THIS module instead, so the
 * browser bundle stays small. Everything here is either a pure string
 * function or a short constant.
 */

export const BENCHMARK = { symbol: "^NSEI", name: "Nifty 50" };

/**
 * Sector taxonomy. Kept as a literal rather than derived from the universe so
 * that importing it does not drag the whole table into the client bundle.
 * Must stay in sync with the sectors used in `nse-universe.ts` — the
 * `npm test` suite asserts that it does.
 */
export const SECTORS: string[] = [
  "Auto Ancillary",
  "Automobile",
  "Aviation",
  "Banking",
  "Building Materials",
  "Capital Goods",
  "Capital Markets",
  "Cement",
  "Chemicals",
  "Conglomerate",
  "Consumer Durables",
  "Consumer Tech",
  "Defence",
  "ETF",
  "Energy",
  "FMCG",
  "Financial Services",
  "Healthcare",
  "Hospitality",
  "IT",
  "Industrials",
  "Infrastructure",
  "Insurance",
  "Logistics",
  "Media",
  "Metals",
  "Mining",
  "Other",
  "Paints",
  "Pharma",
  "Power",
  "Real Estate",
  "Retail",
  "Services",
  "Telecom",
  "Textiles",
];

/** Strip the exchange suffix for display: `RELIANCE.NS` -> `RELIANCE`. */
export function displaySymbol(symbol: string): string {
  return symbol.replace(/\.(NS|BO)$/i, "");
}

/**
 * Normalise loose user input into a Yahoo symbol.
 *
 * `reliance` -> `RELIANCE.NS`, `TCS` -> `TCS.NS`, `AAPL.US` -> `AAPL.US`,
 * `^NSEI` -> `^NSEI`. India-first: a bare ticker is assumed to be NSE.
 *
 * Pure string logic on purpose — no table lookup — so it is identical on the
 * server and in the browser and adds nothing to the client bundle.
 */
export function normalizeSymbol(input: string): string {
  const raw = input.trim().toUpperCase();
  if (!raw) return "";
  if (raw.startsWith("^")) return raw;
  if (/\.(NS|BO)$/.test(raw)) return raw;
  if (raw.includes(".")) return raw;
  return `${raw}.NS`;
}

/** True for anything that looks like a plausible ticker rather than a sentence. */
export function looksLikeSymbol(input: string): boolean {
  return /^[A-Za-z0-9&\-^.]{1,20}$/.test(input.trim());
}

/**
 * Scan-depth options, mirrored from `SCAN_TIERS` in `./universe`.
 *
 * Duplicated deliberately: the server module is `server-only` and carries the
 * 120 KB symbol table with it, so the client cannot import from it. The test
 * suite asserts the two stay in sync.
 */
export type ScanTier = "liquid" | "broad" | "full" | "all";

export const SCAN_TIER_OPTIONS: { id: ScanTier; label: string; description: string }[] = [
  {
    id: "liquid",
    label: "Liquid — top 300",
    description: "Large and mid caps with heavy daily turnover. Fastest scan.",
  },
  {
    id: "broad",
    label: "Broad — top 750",
    description: "Adds small caps that still trade enough to enter and exit.",
  },
  {
    id: "full",
    label: "Deep — top 1500",
    description: "Reaches well into the small-cap tail. Noticeably slower on a cold run.",
  },
  {
    id: "all",
    label: "Everything — all listed stocks",
    description:
      "Every equity in the universe, including recent listings. The first run after a restart is slow because each symbol needs its own history request; later runs are fast while the cache is warm.",
  },
];
