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
        // 09:00 to 15:30 brackets the full NSE session with a little margin
        // on the open, matching the form used in SmartAPI's own examples.
        fromdate: `${formatIst(chunk.from).slice(0, 10)} 09:00`,
        todate: `${formatIst(chunk.to).slice(0, 10)} 15:30`,
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
