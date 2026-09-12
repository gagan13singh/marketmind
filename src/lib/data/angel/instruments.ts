import "server-only";

/**
 * Angel One instrument master ("scrip master").
 *
 * SmartAPI addresses instruments by numeric token, not by ticker, so every
 * call needs `RELIANCE` -> `2885` first. Angel One publishes the full mapping
 * as a single public JSON file, refreshed daily.
 *
 * Fetching it at runtime rather than committing a snapshot is what fixes the
 * missing-IPO problem: a stock that listed this morning is in today's file, so
 * it becomes searchable and screenable the same day, with no redeploy.
 *
 * The raw file is large (tens of thousands of instruments across every
 * segment). It is filtered down to NSE cash-segment equities on parse, which
 * leaves a few thousand entries, and the result is cached in memory.
 */

/** Overridable for testing; defaults to Angel One's published file. */
const SCRIP_MASTER_URL =
  process.env.ANGEL_SCRIP_MASTER_URL?.trim() ||
  "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json";

/** The file is regenerated daily, so a 12-hour cache is comfortably fresh. */
const TTL_MS = 12 * 60 * 60 * 1000;

/**
 * The scrip master is a single JSON file covering every instrument on every
 * segment — tens of megabytes. On a home connection the download alone can
 * take well over a minute, so the old 45-second ceiling aborted the request
 * before it had a chance on exactly the networks that needed the most time.
 */
const TIMEOUT_MS = (() => {
  const raw = Number(process.env.ANGEL_SCRIP_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 10_000 ? raw : 120_000;
})();

/**
 * How long to wait before retrying after a failed download.
 *
 * Without this, every caller that missed the cache started its own download.
 * A single health check stacked two full timeouts back to back and took three
 * minutes to tell the user something was wrong.
 */
const FAILURE_BACKOFF_MS = 60_000;

export interface Instrument {
  /** Numeric token SmartAPI uses to identify the instrument. */
  token: string;
  /** Angel One trading symbol, e.g. `RELIANCE-EQ` or `Nifty 50`. */
  tradingSymbol: string;
  /** Bare ticker, e.g. `RELIANCE`. This is what our universe keys on. */
  ticker: string;
  name: string;
  exchange: "NSE";
  lotSize: number;
  tickSize: number;
  /** Indices carry no volume and cannot be traded directly. */
  kind: "equity" | "index";
}

/**
 * Yahoo-style index symbols mapped to how Angel One names the same index.
 *
 * The app addresses the benchmark as `^NSEI` because that is what the rest of
 * the codebase and the universe file use. Angel One calls it "Nifty 50", so
 * the two vocabularies have to be reconciled somewhere, and doing it here
 * keeps every caller unaware of the difference.
 */
const INDEX_ALIASES: Record<string, string[]> = {
  "^NSEI": ["NIFTY50", "NIFTY"],
  "^NSEBANK": ["NIFTYBANK", "BANKNIFTY"],
  "^CNXIT": ["NIFTYIT"],
  "^CNXAUTO": ["NIFTYAUTO"],
  "^CNXPHARMA": ["NIFTYPHARMA"],
  "^CNXFMCG": ["NIFTYFMCG"],
  "^CRSLDX": ["NIFTY500"],
  "^INDIAVIX": ["INDIAVIX"],
};

/**
 * Well-known NSE index tokens, used only if the scrip master does not yield a
 * match by name.
 *
 * The dashboard always needs the Nifty 50, so leaving it dependent on Angel
 * One's exact spelling would mean one rename upstream silently turns the
 * benchmark into generated data. These tokens are stable and documented in
 * SmartAPI's own examples.
 */
const KNOWN_INDEX_TOKENS: Record<string, { token: string; name: string }> = {
  "^NSEI": { token: "99926000", name: "Nifty 50" },
  "^NSEBANK": { token: "99926009", name: "Nifty Bank" },
  "^INDIAVIX": { token: "99926017", name: "India VIX" },
};

/** Collapse a name to a comparable key: `Nifty 50` and `NIFTY-50` both match. */
function indexKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

interface RawScrip {
  token?: string;
  symbol?: string;
  name?: string;
  expiry?: string;
  strike?: string;
  lotsize?: string;
  instrumenttype?: string;
  exch_seg?: string;
  tick_size?: string;
}

interface Cache {
  byTicker: Map<string, Instrument>;
  /** Indices, keyed by their collapsed name (e.g. `NIFTY50`). */
  byIndex: Map<string, Instrument>;
  list: Instrument[];
  fetchedAt: number;
  expires: number;
}

let cache: Cache | null = null;
let inFlight: Promise<Cache | null> | null = null;
let lastError: string | null = null;
let failedUntil = 0;
let timedOut = false;
let pendingSince = 0;

export function lastInstrumentError(): string | null {
  return lastError;
}

/**
 * Keep only NSE cash equities.
 *
 * The `-EQ` suffix is the cash series. `-BE`, `-BZ` and `-SM` are the trade-to-
 * trade, surveillance and SME series; they are real tradeable stocks and are
 * kept too, because excluding them is exactly the kind of silent gap that made
 * symbols go missing before.
 */
const CASH_SERIES = /-(EQ|BE|BZ|SM|ST|IQ)$/;

/**
 * Indices sit in the NSE segment alongside equities but carry no series
 * suffix. Angel One marks them `AMXIDX`, and NSE index tokens share a `99926`
 * prefix; either signal is enough, and accepting both means a change to one
 * does not lose the benchmark.
 */
function isIndexRow(raw: RawScrip, symbol: string, token: string): boolean {
  if (raw.instrumenttype?.trim().toUpperCase() === "AMXIDX") return true;
  if (token.startsWith("99926")) return true;
  // A no-suffix, no-expiry NSE row with a spaced name is an index in practice.
  return !CASH_SERIES.test(symbol) && /\s/.test(symbol);
}

function toInstrument(raw: RawScrip): Instrument | null {
  if (raw.exch_seg !== "NSE") return null;

  const symbol = raw.symbol?.trim();
  const token = raw.token?.trim();
  if (!symbol || !token) return null;

  // Derivatives carry an expiry; cash equities and indices do not.
  if (raw.expiry && raw.expiry.trim() !== "") return null;

  if (CASH_SERIES.test(symbol)) {
    const ticker = symbol.replace(CASH_SERIES, "");
    if (!ticker) return null;

    return {
      token,
      tradingSymbol: symbol,
      ticker,
      name: raw.name?.trim() || ticker,
      exchange: "NSE",
      lotSize: Number(raw.lotsize) || 1,
      tickSize: Number(raw.tick_size) || 5,
      kind: "equity",
    };
  }

  if (isIndexRow(raw, symbol, token)) {
    return {
      token,
      tradingSymbol: symbol,
      ticker: indexKey(symbol),
      name: raw.name?.trim() || symbol,
      exchange: "NSE",
      lotSize: 1,
      tickSize: 0,
      kind: "index",
    };
  }

  return null;
}

async function load(): Promise<Cache | null> {
  const first = await attemptLoad();
  if (first) return first;

  // Retry a dropped connection, but never a timeout. Retrying a timeout only
  // buys a second identical wait, which is how one page load ended up costing
  // two full timeouts back to back.
  if (!timedOut) {
    await new Promise((r) => setTimeout(r, 1_500));
    const second = await attemptLoad();
    if (second) return second;
  }

  failedUntil = Date.now() + FAILURE_BACKOFF_MS;
  return null;
}

async function attemptLoad(): Promise<Cache | null> {
  try {
    const res = await fetch(SCRIP_MASTER_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!res.ok) {
      lastError = `Scrip master returned HTTP ${res.status}.`;
      return null;
    }

    const raw = (await res.json()) as RawScrip[];
    if (!Array.isArray(raw)) {
      lastError = "Scrip master was not a JSON array.";
      return null;
    }

    const byTicker = new Map<string, Instrument>();
    const byIndex = new Map<string, Instrument>();
    const list: Instrument[] = [];

    for (const entry of raw) {
      const instrument = toInstrument(entry);
      if (!instrument) continue;

      if (instrument.kind === "index") {
        // Index names collide less, but keep the first seen either way.
        if (!byIndex.has(instrument.ticker)) {
          byIndex.set(instrument.ticker, instrument);
          list.push(instrument);
        }
        continue;
      }

      // A ticker can appear in more than one series. Prefer plain `-EQ`, which
      // is the one an ordinary order would route to.
      const existing = byTicker.get(instrument.ticker);
      if (existing && existing.tradingSymbol.endsWith("-EQ")) continue;

      byTicker.set(instrument.ticker, instrument);
      if (!existing) list.push(instrument);
    }

    if (byTicker.size === 0) {
      lastError = "Scrip master parsed but contained no NSE equities.";
      return null;
    }

    lastError = null;
    const now = Date.now();
    return { byTicker, byIndex, list, fetchedAt: now, expires: now + TTL_MS };
  } catch (err) {
    const message = (err as Error).message;
    timedOut = /abort|timeout/i.test(message);
    lastError = timedOut
      ? `Timed out after ${Math.round(TIMEOUT_MS / 1000)}s downloading the scrip master. The file is tens of megabytes; on a slow connection raise ANGEL_SCRIP_TIMEOUT_MS.`
      : `Could not fetch scrip master: ${message}`;
    return null;
  }
}

/** Get the instrument map, loading it once and sharing it between callers. */
export async function getInstruments(): Promise<Cache | null> {
  if (cache && Date.now() < cache.expires) return cache;
  if (inFlight) return inFlight;

  // Recently failed: fail fast instead of making every caller wait out another
  // full timeout. The message from the original failure is still reported.
  if (Date.now() < failedUntil) return cache;

  pendingSince = Date.now();
  inFlight = load()
    .then((loaded) => {
      if (loaded) {
        cache = loaded;
        failedUntil = 0;
        timedOut = false;
      }
      return loaded ?? cache;
    })
    .finally(() => {
      inFlight = null;
      pendingSince = 0;
    });

  return inFlight;
}

/**
 * Wait for the instrument master, but no longer than `ms`.
 *
 * The health endpoint uses this so a slow first download reports "still
 * loading" instead of leaving the browser hanging for two minutes. The
 * download is not cancelled — it continues in the background and populates the
 * cache, so the next request finds it ready.
 */
export async function getInstrumentsWithin(ms: number): Promise<Cache | null | "pending"> {
  if (cache && Date.now() < cache.expires) return cache;

  // A download already known to be slower than this window will not become
  // fast for the next caller. Without this, a page doing two lookups in
  // sequence pays the wait twice over for the same in-flight download.
  if (inFlight && pendingSince > 0 && Date.now() - pendingSince >= ms) return "pending";

  return Promise.race([
    getInstruments(),
    new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), ms)),
  ]);
}

/** True when a download is currently in progress. */
export function isInstrumentLoadPending(): boolean {
  return inFlight !== null;
}

/**
 * Start the download at module load rather than on the first lookup.
 *
 * A serverless instance is created a little before it serves its first
 * request, and the instrument master is needed by essentially every request.
 * Starting it here means the download overlaps with module evaluation and
 * routing instead of running after them, which is free latency.
 *
 * Deliberately fire-and-forget. A failure here is recorded by `load()` and
 * reported through `/api/health`; throwing would take the whole module down
 * over a file the app is designed to run without.
 */
function warmInstruments(): void {
  if (process.env.MARKETMIND_FORCE_SAMPLE === "true") return;
  if (!process.env.ANGEL_API_KEY?.trim()) return;
  void getInstruments().catch(() => undefined);
}

warmInstruments();

/**
 * Resolve an application symbol to an Angel One instrument.
 *
 * Accepts `RELIANCE`, `RELIANCE.NS`, `RELIANCE-EQ` and index symbols such as
 * `^NSEI`, so callers do not have to care which form they are holding.
 */
/**
 * How long an ordinary request will wait for the instrument master.
 *
 * This used to be eight seconds, which is the single biggest reason a cold
 * page load felt broken: every first request to a new serverless instance sat
 * behind a multi-megabyte download before it rendered anything. Nothing about
 * waiting longer makes the download arrive sooner — it only moves the cost
 * onto the person watching a blank screen.
 *
 * A short window is enough to catch the case where the file is nearly ready.
 * Past that the request falls back immediately while the download continues in
 * the background, so the next request finds it cached and the app heals itself.
 */
const REQUEST_WAIT_MS = (() => {
  // 3.5s, not the old 8s. The pages that matter now stream their shell before
  // this is consulted, so the wait is hidden rather than stared at — and when
  // it does expire, the fallback is cached for seconds rather than minutes so
  // the next request picks up live data the moment the download lands.
  const raw = Number(process.env.ANGEL_INSTRUMENT_REQUEST_WAIT_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 3_500;
})();

export async function resolveInstrument(symbol: string): Promise<Instrument | null> {
  const raw = symbol.trim().toUpperCase();
  if (!raw) return null;

  const within = await getInstrumentsWithin(REQUEST_WAIT_MS);
  const instruments = within === "pending" ? null : within;

  // Index symbols use a different vocabulary and a different lookup table.
  if (raw.startsWith("^")) {
    const aliases = INDEX_ALIASES[raw] ?? [indexKey(raw.slice(1))];

    for (const alias of aliases) {
      const found = instruments?.byIndex.get(alias);
      if (found) return found;
    }

    // The scrip master did not name it the way we expected. For the handful of
    // indices the app depends on, a known token beats falling back to
    // generated data.
    const known = KNOWN_INDEX_TOKENS[raw];
    if (known) {
      return {
        token: known.token,
        tradingSymbol: known.name,
        ticker: indexKey(known.name),
        name: known.name,
        exchange: "NSE",
        lotSize: 1,
        tickSize: 0,
        kind: "index",
      };
    }
    return null;
  }

  const ticker = raw.replace(/\.(NS|BO)$/, "").replace(CASH_SERIES, "");
  if (!ticker) return null;

  return instruments?.byTicker.get(ticker) ?? null;
}

/** Diagnostics for the health endpoint. */
export function instrumentStatus(): {
  loaded: boolean;
  count: number;
  indexCount: number;
  ageMinutes: number | null;
  error: string | null;
} {
  return {
    loaded: cache !== null,
    count: cache?.byTicker.size ?? 0,
    indexCount: cache?.byIndex.size ?? 0,
    ageMinutes: cache ? Math.round((Date.now() - cache.fetchedAt) / 60_000) : null,
    error: lastError,
  };
}

/** Test helper. Not used by application code. */
export function resetInstruments(): void {
  cache = null;
  lastError = null;
  failedUntil = 0;
}

export { toInstrument as __toInstrumentForTests };
