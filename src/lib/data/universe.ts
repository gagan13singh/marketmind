import "server-only";
import { NSE_UNIVERSE, BY_SYMBOL, BY_TICKER, type UniverseEntry } from "./nse-universe";
import { BENCHMARK, SECTORS, displaySymbol, normalizeSymbol } from "./symbols";

/**
 * Server-side view of the tradeable universe.
 *
 * The full list is ~3,150 names. Two things follow from that:
 *
 *  1. Search must run over all of it — a user typing a small-cap ticker
 *     has to find those names. `searchUniverse` handles that.
 *
 *  2. Bulk scanning must NOT run over all of it. Fetching 3,150 histories on a
 *     cold serverless invocation is impossible inside any platform's execution
 *     limit. `screenerUniverse` returns a liquidity-ranked slice instead, and
 *     the caller decides how deep to go.
 */

export type { UniverseEntry, SymbolKind } from "./nse-universe";
export { BENCHMARK, SECTORS, displaySymbol, normalizeSymbol };

export const UNIVERSE = NSE_UNIVERSE;
export const UNIVERSE_SIZE = NSE_UNIVERSE.length;

export function findInUniverse(symbol: string): UniverseEntry | undefined {
  const upper = symbol.trim().toUpperCase();
  return BY_SYMBOL.get(upper) ?? BY_TICKER.get(displaySymbol(upper));
}

// ---------------------------------------------------------------------------
// Screening tiers
// ---------------------------------------------------------------------------

/**
 * Depth options for a bulk scan, expressed in plain language rather than raw
 * counts. What a trader actually cares about is whether a result is liquid
 * enough to get in and out of, not how many rows were tested.
 */
export const SCAN_TIERS = {
  liquid: {
    label: "Liquid — top 300",
    size: 300,
    description: "Large and mid caps with heavy daily turnover. Fastest scan.",
  },
  broad: {
    label: "Broad — top 750",
    size: 750,
    description: "Adds small caps that still trade enough to enter and exit.",
  },
  full: {
    label: "Deep — top 1500",
    size: 1500,
    description: "Reaches well into the small-cap tail. Noticeably slower on a cold run.",
  },
  all: {
    label: "Everything — all listed stocks",
    size: Number.MAX_SAFE_INTEGER,
    description:
      "Every equity in the universe, including recent listings. The first run after a restart is slow because each symbol needs its own history request; later runs are fast while the cache is warm.",
  },
} as const;

export type ScanTier = keyof typeof SCAN_TIERS;

export function isScanTier(v: unknown): v is ScanTier {
  return typeof v === "string" && v in SCAN_TIERS;
}

/**
 * The candidate set for a bulk scan.
 *
 * The ranked tiers exclude SME and ETF rows: SME scrips trade in lots with
 * wide spreads and rarely carry the 220 sessions the screener needs, and an
 * ETF has no technical "verdict" worth publishing.
 *
 * `all` deliberately includes them. It means everything listed, and quietly
 * dropping several hundred rows from a tier labelled "everything" is exactly
 * the kind of invisible gap that makes a screener untrustworthy. Rows without
 * enough history are skipped later, on their own merits.
 */
export function screenerUniverse(tier: ScanTier = "liquid", sectors: string[] = []): UniverseEntry[] {
  const pool = tier === "all" ? NSE_UNIVERSE : NSE_UNIVERSE.filter((u) => u.kind === "equity");
  // `all` uses MAX_SAFE_INTEGER as its size, so slice simply returns the pool.
  const sliced = pool.slice(0, SCAN_TIERS[tier].size);
  if (sectors.length === 0) return sliced;
  const wanted = new Set(sectors);
  return sliced.filter((u) => wanted.has(u.sector));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function nameWordStartsWith(name: string, q: string): boolean {
  for (const word of name.split(/[\s(]+/)) {
    if (word.startsWith(q)) return true;
  }
  return false;
}

/**
 * Rank a query against the whole universe.
 *
 * Scoring is deliberately blunt: exact ticker, then ticker prefix, then name
 * prefix, then substring. Ties break on liquidity, which is almost always what
 * the user meant — someone typing "TATA" wants Tata Motors ahead of a shell
 * company with the same word in its name.
 */
export function searchUniverse(query: string, limit = 12): UniverseEntry[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const bare = displaySymbol(q);
  const scored: { entry: UniverseEntry; score: number }[] = [];

  for (const entry of NSE_UNIVERSE) {
    const ticker = entry.ticker;
    const name = entry.name.toUpperCase();

    let score = 0;
    if (ticker === bare) score = 1000;
    else if (name === bare) score = 950;
    else if (ticker.startsWith(bare)) score = 800;
    else if (name.startsWith(bare)) score = 700;
    else if (nameWordStartsWith(name, bare)) score = 600;
    else if (ticker.includes(bare)) score = 400;
    else if (name.includes(bare)) score = 300;
    else continue;

    // SME and ETF rows are legitimate results but should never outrank a
    // mainboard equity that matched just as well.
    if (entry.kind !== "equity") score -= 150;

    scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score || b.entry.turnoverLacs - a.entry.turnoverLacs);
  return scored.slice(0, limit).map((s) => s.entry);
}
