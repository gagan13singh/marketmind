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
    return loaded
      ? {
          candles: null,
          reason: "not-found",
          message: `${symbol} is not in Angel One's NSE instrument list.`,
        }
      : {
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

interface RawQuote {
  tradingSymbol?: string;
  symbolToken?: string;
  ltp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  lastTradeQty?: number;
  tradeVolume?: number;
  netChange?: number;
  percentChange?: number;
  avgPrice?: number;
  weekHigh52?: number;
  weekLow52?: number;
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
  if (!raw || !Number.isFinite(raw.ltp) || (raw.ltp ?? 0) <= 0) return null;

  const price = raw.ltp as number;
  const previousClose =
    Number.isFinite(raw.close) && (raw.close ?? 0) > 0
      ? (raw.close as number)
      : price;
  const change = Number.isFinite(raw.netChange)
    ? (raw.netChange as number)
    : price - previousClose;

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
    changePercent: Number.isFinite(raw.percentChange)
      ? (raw.percentChange as number)
      : previousClose === 0
        ? 0
        : (change / previousClose) * 100,
    dayHigh: Number.isFinite(raw.high) ? (raw.high as number) : price,
    dayLow: Number.isFinite(raw.low) ? (raw.low as number) : price,
    // The 52-week range is required by the type. When SmartAPI omits it, the
    // day's own range is the honest stand-in rather than a zero that would
    // make the stock look like it had crashed to nothing.
    fiftyTwoWeekHigh:
      Number.isFinite(raw.weekHigh52) && (raw.weekHigh52 as number) > 0
        ? (raw.weekHigh52 as number)
        : Math.max(price, Number(raw.high) || price),
    fiftyTwoWeekLow:
      Number.isFinite(raw.weekLow52) && (raw.weekLow52 as number) > 0
        ? (raw.weekLow52 as number)
        : Math.min(price, Number(raw.low) || price),
    volume: Number.isFinite(raw.tradeVolume) ? (raw.tradeVolume as number) : 0,
    averageVolume: Number.isFinite(raw.tradeVolume)
      ? (raw.tradeVolume as number)
      : 0,
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
  const close = Number(raw.ltp);
  if (!Number.isFinite(close) || close <= 0) return null;

  // Before the first trade the open can be zero; fall back to the last price
  // so the bar is still well formed rather than dropping to a nonsense low.
  const open = Number.isFinite(raw.open) && (raw.open as number) > 0 ? (raw.open as number) : close;
  const high = Number.isFinite(raw.high) && (raw.high as number) > 0 ? (raw.high as number) : close;
  const low = Number.isFinite(raw.low) && (raw.low as number) > 0 ? (raw.low as number) : close;
  const volume = Number.isFinite(raw.tradeVolume) ? Math.max(0, raw.tradeVolume as number) : 0;

  return {
    time,
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    volume,
  };
}

/**
 * Fetch today's bar for many symbols at once.
 *
 * Symbols that cannot be resolved, or that the quote endpoint does not return,
 * are simply absent from the map — a missing top-up is never an error, because
 * the settled history behind it is still perfectly usable.
 */
export async function fetchAngelTodayBars(symbols: string[]): Promise<Map<string, Candle>> {
  const out = new Map<string, Candle>();
  if (!isConfigured() || symbols.length === 0) return out;
  if (!isWeekday() || !sessionHasOpened()) return out;

  // Resolve first so the request carries tokens, and keep the reverse mapping
  // to attribute each result back to the caller's symbol.
  const byToken = new Map<string, string>();
  for (const symbol of symbols) {
    const instrument = await resolveInstrument(symbol);
    if (instrument) byToken.set(instrument.token, symbol);
  }
  if (byToken.size === 0) return out;

  const tokens = [...byToken.keys()];
  const time = todaySessionOpen();

  for (let i = 0; i < tokens.length; i += QUOTE_BATCH) {
    const slice = tokens.slice(i, i + QUOTE_BATCH);

    const result = await angelRequest<{ fetched?: RawQuote[] }>(
      QUOTE_PATH,
      { mode: "FULL", exchangeTokens: { NSE: slice } },
      { circuit: "angel-quote" },
    );
    if (!result.ok) continue;

    for (const raw of result.data.fetched ?? []) {
      const symbol = raw.symbolToken ? byToken.get(raw.symbolToken) : undefined;
      if (!symbol) continue;

      const candle = candleFromQuote(raw, time);
      if (candle) out.set(symbol, candle);
    }
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
