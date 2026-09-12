import "server-only";
import type { Candle, Quote } from "@/types";
import {
  angelRequest,
  clearSession,
  hasSession,
  isConfigured,
  lastAuthError,
  probeLogin,
  rateLimitHeadroom,
  readCredentials,
  type AngelFailure,
} from "./client";
import {
  getInstrumentsWithin,
  instrumentStatus,
  isInstrumentLoadPending,
  lastInstrumentError,
  resolveInstrument,
} from "./instruments";

/**
 * Angel One as a market-data provider.
 *
 * Exposes exactly what the rest of the app needs — daily candles and a quote —
 * and hides tokens, sessions and rate limits behind that.
 *
 * Only daily candles are requested. Weekly and monthly views are resampled
 * from dailies upstream so that every timeframe is derived from one series and
 * the analysis engine cannot disagree with the chart.
 */

export { isConfigured as isAngelConfigured, clearSession as clearAngelSession };

/** True while the instrument master download is in flight. */
export function instrumentsStillLoading(): boolean {
  return !instrumentStatus().loaded && isInstrumentLoadPending();
}

const HISTORY_PATH = "/rest/secure/angelbroking/historical/v1/getCandleData";
const QUOTE_PATH = "/rest/secure/angelbroking/market/v1/quote/";

/**
 * SmartAPI caps a single ONE_DAY request at 2000 calendar days.
 *
 * The chunk size stays a little under that. Whether the documented ceiling is
 * counted inclusively is not specified, and a range landing exactly on the
 * limit is the kind of thing that fails only for the longest lookback — the
 * case least likely to be noticed in testing.
 */
const MAX_DAYS_PER_REQUEST = 1900;

export interface AngelHistory {
  candles: Candle[];
  token: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** SmartAPI wants `YYYY-MM-DD HH:mm` in IST. */
function formatIst(date: Date): string {
  // IST is UTC+5:30 with no daylight saving, so a fixed offset is exact.
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(
    ist.getUTCHours(),
  )}:${pad(ist.getUTCMinutes())}`;
}

function yearsForRange(range: string): number {
  switch (range) {
    case "1y":
      return 1;
    case "2y":
      return 2;
    case "10y":
      return 10;
    case "max":
      return 15;
    default:
      return 5;
  }
}

/**
 * SmartAPI returns candles as positional arrays:
 * `[timestamp, open, high, low, close, volume]`, timestamp being an ISO string
 * with an IST offset.
 */
type RawCandle = [string, number, number, number, number, number];

function parseCandles(raw: unknown): Candle[] {
  if (!Array.isArray(raw)) return [];

  const out: Candle[] = [];
  for (const row of raw as RawCandle[]) {
    if (!Array.isArray(row) || row.length < 6) continue;

    const time = Date.parse(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);

    if (!Number.isFinite(time) || !Number.isFinite(close) || close <= 0)
      continue;
    if (
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low)
    )
      continue;

    out.push({
      time,
      open,
      // Guard against rows where the high/low do not bracket open/close.
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      volume: Number.isFinite(volume) && volume > 0 ? volume : 0,
    });
  }

  return dedupeAndSort(out);
}

/**
 * Sort chronologically and collapse duplicate sessions.
 *
 * Kept separate from parsing because chunked requests overlap at their
 * boundaries: the raw rows are parsed per chunk, then the stitched series is
 * deduped as `Candle[]`. Running the raw-row parser over already-parsed
 * candles silently produced an empty series.
 */
function dedupeAndSort(candles: Candle[]): Candle[] {
  const sorted = [...candles].sort((a, b) => a.time - b.time);

  const deduped: Candle[] = [];
  for (const candle of sorted) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.time === candle.time) {
      deduped[deduped.length - 1] = candle;
      continue;
    }
    deduped.push(candle);
  }
  return deduped;
}

export interface AngelFetchOutcome {
  candles: Candle[] | null;
  reason?: AngelFailure;
  message?: string;
}

/**
 * Fetch daily candles for a symbol.
 *
 * Ranges longer than SmartAPI's per-request window are split into chunks and
 * stitched back together. Chunks are fetched sequentially on purpose: the
 * shared rate limiter would serialise them anyway, and doing it here keeps the
 * ordering obvious.
 */
export async function fetchAngelHistory(
  symbol: string,
  range = "5y",
): Promise<AngelFetchOutcome> {
  if (!isConfigured()) {
    return {
      candles: null,
      reason: "not-configured",
      message: "Angel One credentials are not set.",
    };
  }

  const instrument = await resolveInstrument(symbol);
  if (!instrument) {
    // These are different problems with different fixes, and reporting the
    // first as the second sends the reader hunting for a bad ticker when the
    // real issue is that no tickers can be resolved at all.
    const loaded = instrumentStatus().loaded;
    if (loaded) {
      return {
        candles: null,
        reason: "not-found",
        message: `${symbol} is not in Angel One's NSE instrument list.`,
      };
    }

    // Still downloading is a different thing from failed, and the difference
    // is load-bearing: the caller caches a transient miss for seconds and a
    // real failure for much longer. Conflating them is what made the app sit
    // on generated numbers long after live data had become available.
    if (isInstrumentLoadPending()) {
      return {
        candles: null,
        reason: "loading",
        message:
          "Angel One's instrument list is still downloading, so this view is showing generated sample data for a moment.",
      };
    }

    return {
      candles: null,
      reason: "network",
      message: `Instrument master unavailable, so ${symbol} cannot be resolved to a token.${
        lastInstrumentError() ? ` ${lastInstrumentError()}` : ""
      }`,
    };
  }

  const years = yearsForRange(range);
  const end = new Date();
  const start = new Date(end.getTime() - years * 365.25 * 24 * 60 * 60 * 1000);

  const chunks: { from: Date; to: Date }[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const chunkEnd = new Date(
      Math.min(
        end.getTime(),
        cursor.getTime() + MAX_DAYS_PER_REQUEST * 24 * 60 * 60 * 1000,
      ),
    );
    chunks.push({ from: new Date(cursor), to: chunkEnd });
    cursor = new Date(chunkEnd.getTime() + 24 * 60 * 60 * 1000);
  }

  const all: Candle[] = [];
  let failure: AngelFetchOutcome | null = null;

  for (const chunk of chunks) {
    const result = await angelRequest<unknown>(
      HISTORY_PATH,
      {
        exchange: "NSE",
        symboltoken: instrument.token,
        interval: "ONE_DAY",
        // The window runs to end-of-day rather than to the closing bell.
        // Ending it at 15:30 relies on the boundary being inclusive, and a
        // range that stops exactly at the last bar's session is the kind of
        // thing that silently drops today's candle.
        fromdate: `${formatIst(chunk.from).slice(0, 10)} 09:00`,
        todate: `${formatIst(chunk.to).slice(0, 10)} 23:59`,
      },
      { circuit: "angel-history" },
    );

    if (!result.ok) {
      // A partial series is still useful; only report failure if we got nothing.
      failure = {
        candles: null,
        reason: result.reason,
        message: result.message,
      };
      continue;
    }
    all.push(...parseCandles(result.data));
  }

  if (all.length === 0) {
    return (
      failure ?? {
        candles: null,
        reason: "not-found",
        message: "No candles returned.",
      }
    );
  }

  return { candles: dedupeAndSort(all) };
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

/**
 * A quote row as SmartAPI returns it.
 *
 * Deliberately loose. Angel One's published examples and its various client
 * SDKs disagree about several key names — the 52-week range appears as both
 * `52WeekHigh` and `weekHigh52` depending on where you look — and a key that
 * does not match is silently `undefined` rather than an error. Reading through
 * a tolerant accessor means one renamed field degrades one number instead of
 * dropping the whole row.
 */
interface RawQuote {
  [key: string]: unknown;
}

/** First finite number found under any of the candidate keys. */
function pickNumber(raw: RawQuote, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = Number(raw[key]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

/** First non-empty string found under any of the candidate keys. */
function pickString(raw: RawQuote, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse the exchange feed timestamp and return the IST civil date it falls on.
 *
 * SmartAPI reports this as `"21-Mar-2024 10:51:22"` in IST. Using it rather
 * than the server clock is what makes the top-up correct: it dates the bar to
 * the session the exchange actually reported, so a stale quote pulled after
 * hours is recognised as belonging to an earlier day instead of being stamped
 * with today's date.
 */
export function parseExchangeTime(value: string | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null;

  const dmy = value.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (dmy) {
    const month = MONTHS[dmy[2].toLowerCase()];
    if (month === undefined) return null;
    return { year: Number(dmy[3]), month: month + 1, day: Number(dmy[1]) };
  }

  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };

  return null;
}

/**
 * Fetch a full quote.
 *
 * The market-quote endpoint returns the day's OHLC, the previous close, the
 * traded volume and the 52-week range in one call — everything the header
 * needs without deriving it from history.
 */
export async function fetchAngelQuote(
  symbol: string,
  fallbackName?: string,
  sector?: string | null,
): Promise<Quote | null> {
  if (!isConfigured()) return null;

  const instrument = await resolveInstrument(symbol);
  if (!instrument) return null;

  const result = await angelRequest<{
    fetched?: RawQuote[];
    unfetched?: unknown[];
  }>(
    QUOTE_PATH,
    { mode: "FULL", exchangeTokens: { NSE: [instrument.token] } },
    { circuit: "angel-quote" },
  );

  if (!result.ok) return null;

  const raw = result.data.fetched?.[0];
  if (!raw) return null;

  const price = pickNumber(raw, "ltp", "lastPrice", "last_traded_price") ?? 0;
  if (price <= 0) return null;

  const prevRaw = pickNumber(raw, "close", "previousClose", "prevClose");
  const previousClose = prevRaw && prevRaw > 0 ? prevRaw : price;
  const change = pickNumber(raw, "netChange", "change") ?? price - previousClose;
  const dayHigh = pickNumber(raw, "high", "dayHigh");
  const dayLow = pickNumber(raw, "low", "dayLow");
  const volume = pickNumber(raw, "tradeVolume", "volume", "totalTradedVolume") ?? 0;
  const pct = pickNumber(raw, "percentChange", "changePercent");
  const wkHigh = pickNumber(raw, "52WeekHigh", "weekHigh52", "fiftyTwoWeekHigh");
  const wkLow = pickNumber(raw, "52WeekLow", "weekLow52", "fiftyTwoWeekLow");

  return {
    symbol: symbol.toUpperCase().endsWith(".NS")
      ? symbol.toUpperCase()
      : `${instrument.ticker}.NS`,
    name: fallbackName ?? instrument.name,
    exchange: "NSE",
    currency: "INR",
    price,
    previousClose,
    change,
    changePercent: pct ?? (previousClose === 0 ? 0 : (change / previousClose) * 100),
    dayHigh: dayHigh && dayHigh > 0 ? dayHigh : price,
    dayLow: dayLow && dayLow > 0 ? dayLow : price,
    // The 52-week range is required by the type. When SmartAPI omits it under
    // every spelling, the day's own range is the honest stand-in rather than a
    // zero that would make the stock look like it had crashed to nothing.
    fiftyTwoWeekHigh: wkHigh && wkHigh > 0 ? wkHigh : Math.max(price, dayHigh ?? price),
    fiftyTwoWeekLow: wkLow && wkLow > 0 ? wkLow : Math.min(price, dayLow ?? price),
    volume,
    averageVolume: volume,
    // SmartAPI is an execution API, not a fundamentals API. These stay null
    // rather than being invented; the fundamentals page sources them elsewhere.
    marketCap: null,
    peRatio: null,
    sector: sector ?? null,
    industry: null,
  };
}

// ---------------------------------------------------------------------------
// Today's bar
// ---------------------------------------------------------------------------

/**
 * Angel One's historical feed carries *settled* daily candles. Today's bar can
 * be absent from it for hours after the close, which leaves the whole app a
 * session behind on the evening a swing trader is actually reviewing charts.
 *
 * The quote endpoint does not have that lag: it reports the day's open, high,
 * low, last price and volume in real time. Those five numbers are exactly a
 * daily candle, so today's bar is reconstructed from the quote and appended to
 * the settled history.
 *
 * It also batches — up to 50 instruments per request — so topping up an entire
 * screener scan costs about sixty extra calls rather than one per symbol.
 */
const QUOTE_BATCH = 50;

/** Civil date and time in IST, which has a fixed +05:30 offset year round. */
export function istNow(at: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutesIntoDay: number;
} {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth() + 1,
    day: ist.getUTCDate(),
    weekday: ist.getUTCDay(),
    minutesIntoDay: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

/**
 * Epoch milliseconds for today's 09:15 IST open.
 *
 * Settled candles are timestamped at the open, so a synthesized bar has to use
 * the same instant or it would sort as a separate session.
 */
export function todaySessionOpen(at: Date = new Date()): number {
  const { year, month, day } = istNow(at);
  return Date.UTC(year, month - 1, day, 3, 45, 0); // 09:15 IST
}

/** NSE trades Monday to Friday. Holidays are caught by the staleness check. */
export function isWeekday(at: Date = new Date()): boolean {
  const { weekday } = istNow(at);
  return weekday >= 1 && weekday <= 5;
}

/** True once the session has opened; before that there is no bar to fetch. */
export function sessionHasOpened(at: Date = new Date()): boolean {
  return istNow(at).minutesIntoDay >= 9 * 60 + 15;
}

function candleFromQuote(raw: RawQuote, time: number): Candle | null {
  const close = pickNumber(raw, "ltp", "lastPrice", "last_traded_price") ?? 0;
  if (close <= 0) return null;

  // Before the first trade the open can be zero; fall back to the last price
  // so the bar is still well formed rather than dropping to a nonsense low.
  const rawOpen = pickNumber(raw, "open", "openPrice") ?? 0;
  const rawHigh = pickNumber(raw, "high", "dayHigh") ?? 0;
  const rawLow = pickNumber(raw, "low", "dayLow") ?? 0;

  const open = rawOpen > 0 ? rawOpen : close;
  const high = rawHigh > 0 ? rawHigh : close;
  const low = rawLow > 0 ? rawLow : close;

  return {
    time,
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    volume: Math.max(0, pickNumber(raw, "tradeVolume", "volume", "totalTradedVolume") ?? 0),
  };
}

/** Why a symbol did or did not receive a fresh bar. Surfaced by /api/diagnose. */
export interface TodayBarReport {
  requested: number;
  resolved: number;
  returned: number;
  matched: number;
  skippedReason?: string;
  /** The exchange feed timestamps seen, so a stale feed is visible. */
  feedTimes: string[];
}

/**
 * Fetch the latest session's bar for many symbols at once.
 *
 * Matching is deliberately defensive. The response is attributed back to the
 * caller's symbol by instrument token, then by trading symbol, then — for a
 * single-instrument request — by position. Relying on one key alone means a
 * field named differently than expected silently drops every row, and the only
 * visible symptom is a chart quietly stuck on yesterday.
 */
export async function fetchAngelTodayBars(
  symbols: string[],
  report?: { value: TodayBarReport },
): Promise<Map<string, Candle>> {
  const out = new Map<string, Candle>();
  const stats: TodayBarReport = {
    requested: symbols.length,
    resolved: 0,
    returned: 0,
    matched: 0,
    feedTimes: [],
  };
  if (report) report.value = stats;

  if (!isConfigured() || symbols.length === 0) {
    stats.skippedReason = "Angel One is not configured.";
    return out;
  }

  // No weekday or clock gate here on purpose. An earlier version refused to
  // even ask outside session hours, which meant a quote that would have
  // supplied the missing bar was never requested. The exchange timestamp on
  // the response decides which session the data belongs to, so asking is
  // always safe and the answer carries its own date.

  const byToken = new Map<string, string>();
  const byTradingSymbol = new Map<string, string>();
  for (const symbol of symbols) {
    const instrument = await resolveInstrument(symbol);
    if (!instrument) continue;
    byToken.set(instrument.token, symbol);
    byTradingSymbol.set(instrument.tradingSymbol.toUpperCase(), symbol);
  }
  stats.resolved = byToken.size;

  if (byToken.size === 0) {
    stats.skippedReason = "No symbol could be resolved to an instrument token.";
    return out;
  }

  const tokens = [...byToken.keys()];

  for (let i = 0; i < tokens.length; i += QUOTE_BATCH) {
    const slice = tokens.slice(i, i + QUOTE_BATCH);

    const result = await angelRequest<{ fetched?: RawQuote[] }>(
      QUOTE_PATH,
      { mode: "FULL", exchangeTokens: { NSE: slice } },
      { circuit: "angel-quote" },
    );
    if (!result.ok) {
      stats.skippedReason = `Quote request failed: ${result.message}`;
      continue;
    }

    const rows = result.data.fetched ?? [];
    stats.returned += rows.length;

    for (let r = 0; r < rows.length; r += 1) {
      const raw = rows[r];

      const token = pickString(raw, "symbolToken", "symboltoken", "token");
      const trading = pickString(raw, "tradingSymbol", "tradingsymbol", "symbol");

      const symbol =
        (token ? byToken.get(token) : undefined) ??
        (trading ? byTradingSymbol.get(trading.toUpperCase()) : undefined) ??
        // Single-instrument request: position is unambiguous.
        (slice.length === 1 && rows.length === 1 ? byToken.get(slice[0]) : undefined);

      if (!symbol) continue;

      // Date the bar from the exchange's own timestamp where available, so a
      // quote served after hours is attributed to the session it belongs to
      // rather than to whatever day the server thinks it is.
      const feedTime = pickString(raw, "exchFeedTime", "exchTradeTime", "feedTime");
      if (feedTime && stats.feedTimes.length < 3) stats.feedTimes.push(feedTime);

      const parts = parseExchangeTime(feedTime);
      const time = parts
        ? Date.UTC(parts.year, parts.month - 1, parts.day, 3, 45, 0)
        : todaySessionOpen();

      const candle = candleFromQuote(raw, time);
      if (candle) {
        out.set(symbol, candle);
        stats.matched += 1;
      }
    }
  }

  if (out.size === 0 && !stats.skippedReason) {
    stats.skippedReason =
      stats.returned === 0
        ? "The quote endpoint returned no rows."
        : "Rows came back but none could be matched to a requested symbol.";
  }

  return out;
}

/**
 * Append today's bar to a settled series, if it is genuinely missing and
 * genuinely new.
 *
 * The equality check is what makes this safe on a market holiday: the quote
 * endpoint keeps returning the previous session's numbers when nothing is
 * trading, so a bar whose OHLCV matches the last settled candle is stale data
 * wearing today's date, and is discarded.
 */
export function withTodayBar(settled: Candle[], today: Candle | undefined): Candle[] {
  if (!today || settled.length === 0) return settled;

  const last = settled[settled.length - 1];
  const identical =
    last.open === today.open &&
    last.high === today.high &&
    last.low === today.low &&
    last.close === today.close &&
    last.volume === today.volume;

  // Already carrying today's bar: replace it, because during an open session
  // the price keeps moving and a bar written once would sit frozen.
  if (last.time === today.time) {
    return identical ? settled : [...settled.slice(0, -1), today];
  }

  // Settled history is somehow ahead of the quote; leave it alone.
  if (last.time > today.time) return settled;

  // Appending a new session. The equality check is what makes this safe on a
  // market holiday: the quote endpoint keeps returning the previous session's
  // numbers when nothing is trading, so a bar identical to the last settled
  // candle is stale data wearing today's date.
  return identical ? settled : [...settled, today];
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * The quote response for one symbol, unparsed.
 *
 * Returned verbatim so /api/diagnose can show exactly which keys Angel One
 * sent. Every other reader goes through the tolerant accessors, which means a
 * renamed field reads as `undefined` — correct behaviour, but it hides the one
 * fact needed to diagnose the problem.
 */
export async function angelRawQuote(
  symbol: string,
): Promise<{ ok: boolean; message: string; row?: Record<string, unknown> }> {
  if (!isConfigured()) return { ok: false, message: "Angel One is not configured." };

  const instrument = await resolveInstrument(symbol);
  if (!instrument) return { ok: false, message: `Could not resolve ${symbol} to an instrument token.` };

  const result = await angelRequest<{ fetched?: Record<string, unknown>[]; unfetched?: unknown[] }>(
    QUOTE_PATH,
    { mode: "FULL", exchangeTokens: { NSE: [instrument.token] } },
    { circuit: "angel-quote" },
  );

  if (!result.ok) return { ok: false, message: result.message };

  const row = result.data.fetched?.[0];
  return row
    ? { ok: true, message: "Quote returned.", row }
    : { ok: false, message: "Quote succeeded but returned no rows for this token." };
}

export interface AngelStatus {
  configured: boolean;
  authenticated: boolean;
  authError: string | null;
  instruments: ReturnType<typeof instrumentStatus>;
  rateLimitHeadroom: number;
  missing: string[];
}

/** What the health endpoint reports. Never throws. */
export function angelStatus(): AngelStatus {
  const missing: string[] = [];
  for (const [key, present] of [
    ["ANGEL_API_KEY", Boolean(process.env.ANGEL_API_KEY?.trim())],
    ["ANGEL_CLIENT_CODE", Boolean(process.env.ANGEL_CLIENT_CODE?.trim())],
    ["ANGEL_PIN", Boolean(process.env.ANGEL_PIN?.trim())],
    ["ANGEL_TOTP_SECRET", Boolean(process.env.ANGEL_TOTP_SECRET?.trim())],
  ] as const) {
    if (!present) missing.push(key);
  }

  return {
    configured: readCredentials() !== null,
    authenticated: hasSession(),
    authError: lastAuthError(),
    instruments: instrumentStatus(),
    rateLimitHeadroom: rateLimitHeadroom(),
    missing,
  };
}

export interface AngelProbeResult {
  ok: boolean;
  message: string;
  login: { ok: boolean; message: string };
  instruments: { ok: boolean; pending: boolean; count: number; message: string };
}

/**
 * Exercise the two things that can independently break, and report each.
 *
 * Login is tested first and on its own, so the answer to "are my credentials
 * right?" no longer depends on a large file downloading successfully.
 */
export async function angelProbe(instrumentWaitMs = 25_000): Promise<AngelProbeResult> {
  if (!isConfigured()) {
    const message = "Credentials not set.";
    return {
      ok: false,
      message,
      login: { ok: false, message },
      instruments: { ok: false, pending: false, count: 0, message: "Not attempted." },
    };
  }

  const login = await probeLogin();

  const loaded = await getInstrumentsWithin(instrumentWaitMs);
  const pending = loaded === "pending";
  const resolved = pending ? null : loaded;

  const instruments = {
    ok: Boolean(resolved && resolved.byTicker.size > 0),
    pending,
    count: resolved?.byTicker.size ?? 0,
    message: pending
      ? `Still downloading after ${Math.round(instrumentWaitMs / 1000)}s. It continues in the background — check again shortly.`
      : resolved && resolved.byTicker.size > 0
        ? `Loaded ${resolved.byTicker.size.toLocaleString("en-IN")} NSE instruments.`
        : (lastInstrumentError() ?? "Could not load the instrument master."),
  };

  if (!login.ok || !instruments.ok) {
    return { ok: false, message: !login.ok ? login.message : instruments.message, login, instruments };
  }

  const candles = await fetchAngelHistory("RELIANCE.NS", "1y");
  if (candles.candles && candles.candles.length > 0) {
    return {
      ok: true,
      message: `Live. ${candles.candles.length} daily candles for RELIANCE.`,
      login,
      instruments,
    };
  }

  return {
    ok: false,
    message: candles.message ?? "No candles returned.",
    login,
    instruments,
  };
}
