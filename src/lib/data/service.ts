import "server-only";
import type {
  BalanceSheetPeriod,
  Candle,
  CashFlowPeriod,
  DataProvider,
  FinancialPeriod,
  FundamentalSnapshot,
  Quote,
  SearchResult,
  Sourced,
  Timeframe,
} from "@/types";
import { fetchQuoteSummary, num } from "./yahoo";
import { fetchAngelHistory, fetchAngelQuote } from "./angel";
import { resample } from "@/lib/indicators";
import { sampleCandles, sampleFundamentals, sampleQuote } from "./sample";
import { displaySymbol, findInUniverse, normalizeSymbol, searchUniverse } from "./universe";

/**
 * The single entry point the rest of the app uses for market data.
 *
 * Responsibilities:
 *  1. Try live data.
 *  2. On any failure, degrade to labelled sample data instead of erroring.
 *  3. Cache aggressively — swing/positional analysis does not need tick data,
 *     and this keeps us well inside serverless execution limits.
 */

const FORCED_SAMPLE_NOTICE =
  "MARKETMIND_FORCE_SAMPLE is enabled, so this view is running on generated sample data. Unset it to fetch live prices from Angel One.";

/**
 * Explain the fallback in terms the reader can act on.
 *
 * "Data unavailable" tells nobody anything. Missing credentials, a rejected
 * login and an unlisted symbol are three different problems with three
 * different fixes, so they get three different sentences.
 */
function sampleNotice(reason?: string, detail?: string): string {
  switch (reason) {
    case "not-configured":
      return "Angel One credentials are not configured, so this view is running on generated sample data. Add ANGEL_API_KEY, ANGEL_CLIENT_CODE, ANGEL_PIN and ANGEL_TOTP_SECRET to your environment, then reload.";
    case "auth-failed":
      return `Angel One login failed, so this view is running on generated sample data.${detail ? ` ${detail}` : ""} Check your credentials and that the TOTP secret matches the one on your account.`;
    case "throttled":
      return "Angel One rate limits were hit, so this view is temporarily running on generated sample data. It will recover on its own within a minute.";
    case "not-found":
      return "Angel One has no daily history for this symbol, so this view is running on generated sample data. Recently listed stocks can take a session or two to appear.";
    case "network":
      // Usually the instrument master, and the detail says which. Passing it
      // through matters: "unavailable" sends people hunting in the wrong place.
      return `${detail ?? "Angel One could not be reached."} Showing generated sample data until it recovers — check /api/health for details.`;
    default:
      return "Live market data was unavailable, so this view is running on generated sample data. These prices are illustrative and must not be used for real trading decisions.";
  }
}

const SAMPLE_NOTICE = sampleNotice();

const FUNDAMENTAL_SAMPLE_NOTICE =
  "Live financial statements were unavailable for this symbol, so the figures below are generated sample data. They are illustrative and must not be used for real investment decisions.";

// --- Simple TTL cache (per serverless instance) -----------------------------

interface CacheEntry<T> {
  value: T;
  expires: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Cache capacity, in entries.
 *
 * This has to exceed the universe size or the full-universe scan can never
 * finish. At 400 — the previous value — a 3,153-symbol scan evicted its own
 * earliest histories long before it reached the end, so resuming it made no
 * progress however many times you tried. The scan was not slow, it was
 * unable to converge.
 *
 * Each cached history is roughly 500 daily candles, so budget ~70 KB per
 * symbol: a fully warm universe sits around 220 MB. That is comfortable on a
 * self-hosted server and fine on most serverless tiers, but if you are memory
 * constrained, lower it with MARKETMIND_CACHE_ENTRIES and use the ranked
 * tiers rather than "everything".
 */
const MAX_CACHE_ENTRIES = (() => {
  const raw = Number(process.env.MARKETMIND_CACHE_ENTRIES);
  return Number.isFinite(raw) && raw >= 100 ? Math.floor(raw) : 4_000;
})();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Drop anything already expired before evicting anything still valid —
    // during a long scan that alone usually reclaims enough room.
    const now = Date.now();
    for (const [k, entry] of cache) {
      if (now > entry.expires) cache.delete(k);
    }
  }
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Still full: evict the oldest tenth. Map preserves insertion order, so
    // this is a cheap approximation of least-recently-added.
    const victims = Array.from(cache.keys()).slice(0, Math.ceil(MAX_CACHE_ENTRIES / 10));
    for (const k of victims) cache.delete(k);
  }
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

/** Cache statistics for the health endpoint. */
export function cacheStats(): { entries: number; capacity: number } {
  return { entries: cache.size, capacity: MAX_CACHE_ENTRIES };
}

const TTL = {
  /**
   * Daily candles are end-of-day data: they change once per session, not
   * continuously. A short TTL here is not just wasteful, it is incorrect for
   * the full-universe scan — that takes over twenty minutes at Angel One's
   * three-requests-per-second ceiling, so a ten-minute cache expired its own
   * earliest entries before the scan finished and the scan could never
   * converge no matter how many times it was resumed.
   *
   * Six hours covers a full trading day's worth of resumed scans. The live
   * price shown in headers comes from the quote cache below, which stays
   * short, so nothing on screen goes stale.
   */
  history: 6 * 60 * 60 * 1000,
  quote: 5 * 60 * 1000,
  fundamentals: 6 * 60 * 60 * 1000,
  search: 30 * 60 * 1000,
  /**
   * Sample data is cached for far less time than live data. If the upstream
   * was merely throttled, a short TTL means the very next request gets a fresh
   * attempt at real prices instead of being stuck on generated numbers for the
   * full ten minutes.
   */
  sampleHistory: 45 * 1000,
  sampleQuote: 45 * 1000,
};

/** Set MARKETMIND_FORCE_SAMPLE=true to develop entirely offline. */
function forceSample(): boolean {
  return process.env.MARKETMIND_FORCE_SAMPLE === "true";
}

function stamp(): string {
  return new Date().toISOString();
}

/** Wrap a successful live payload with its provenance. */
function sourced(candles: Candle[], provider: DataProvider): Sourced<Candle[]> {
  const last = candles[candles.length - 1];
  return {
    data: candles,
    origin: "live",
    provider,
    asOf: last ? new Date(last.time).toISOString().slice(0, 10) : undefined,
    fetchedAt: stamp(),
  };
}

function remember<T>(key: string, value: T, ttl: number): T {
  cacheSet(key, value, ttl);
  return value;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export async function getHistory(
  rawSymbol: string,
  timeframe: Timeframe = "daily",
  range = "5y",
): Promise<Sourced<Candle[]>> {
  const symbol = normalizeSymbol(rawSymbol);
  const key = `hist:${symbol}:${timeframe}:${range}`;

  const cached = cacheGet<Sourced<Candle[]>>(key);
  if (cached) return cached;

  if (!forceSample()) {
    // Angel One returns daily candles. Weekly and monthly are resampled from
    // them rather than requested separately, so every timeframe is derived
    // from one series and the chart cannot disagree with the analysis engine.
    const outcome = await fetchAngelHistory(symbol, range);

    if (outcome.candles && outcome.candles.length >= 30) {
      const daily = outcome.candles;
      const shaped = timeframe === "daily" ? daily : resample(daily, timeframe);
      if (shaped.length >= 20) {
        return remember(key, sourced(shaped, "angelone"), TTL.history);
      }
    }

    // Nothing usable came back. Fall through to sample data, but keep the
    // reason so the UI can say something more useful than "unavailable".
    const result: Sourced<Candle[]> = {
      data: sampleCandles(symbol, timeframe, yearsForRange(range)),
      origin: "sample",
      provider: "sample",
      notice: sampleNotice(outcome.reason, outcome.message),
      fetchedAt: stamp(),
    };
    return remember(key, result, TTL.sampleHistory);
  }

  const result: Sourced<Candle[]> = {
    data: sampleCandles(symbol, timeframe, yearsForRange(range)),
    origin: "sample",
    provider: "sample",
    notice: FORCED_SAMPLE_NOTICE,
    fetchedAt: stamp(),
  };
  return remember(key, result, TTL.sampleHistory);
}

function yearsForRange(range: string): number {
  return range === "1y" ? 1 : range === "2y" ? 2 : range === "10y" ? 10 : 5;
}


// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

export async function getQuote(rawSymbol: string): Promise<Sourced<Quote>> {
  const symbol = normalizeSymbol(rawSymbol);
  const key = `quote:${symbol}`;

  const cached = cacheGet<Sourced<Quote>>(key);
  if (cached) return cached;

  if (!forceSample()) {
    const entry = findInUniverse(symbol);

    // The market-quote endpoint carries the day's OHLC, previous close, volume
    // and 52-week range in a single call.
    const live = await fetchAngelQuote(symbol, entry?.name, entry?.sector ?? null);
    if (live && Number.isFinite(live.price) && live.price > 0) {
      const result: Sourced<Quote> = {
        data: live,
        origin: "live",
        provider: "angelone",
        fetchedAt: stamp(),
      };
      return remember(key, result, TTL.quote);
    }

    // The quote endpoint can be unavailable while historical data still works
    // — different rate-limit buckets. Deriving the quote from the candles we
    // already have is better than dropping to generated numbers.
    const history = await getHistory(symbol, "daily", "1y");
    if (history.origin === "live" && history.data.length >= 2) {
      const result: Sourced<Quote> = {
        data: quoteFromCandles(symbol, history.data),
        origin: "live",
        provider: "angelone",
        asOf: history.asOf,
        fetchedAt: stamp(),
      };
      return remember(key, result, TTL.quote);
    }
  }

  const result: Sourced<Quote> = {
    data: sampleQuote(symbol),
    origin: "sample",
    provider: "sample",
    notice: forceSample() ? FORCED_SAMPLE_NOTICE : sampleNotice(),
    fetchedAt: stamp(),
  };
  return remember(key, result, TTL.sampleQuote);
}

/** Build a Quote from raw OHLCV when the provider has no quote endpoint. */
function quoteFromCandles(symbol: string, candles: Candle[]): Quote {
  const last = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : last;
  const change = last.close - prev.close;
  const window = candles.slice(-252);
  const entry = findInUniverse(symbol);

  return {
    symbol,
    name: entry?.name ?? displaySymbol(symbol),
    exchange: "NSE",
    currency: "INR",
    price: last.close,
    previousClose: prev.close,
    change,
    changePercent: prev.close === 0 ? 0 : (change / prev.close) * 100,
    dayHigh: last.high,
    dayLow: last.low,
    fiftyTwoWeekHigh: Math.max(...window.map((c) => c.high)),
    fiftyTwoWeekLow: Math.min(...window.map((c) => c.low)),
    volume: last.volume,
    averageVolume: window.reduce((a, c) => a + c.volume, 0) / Math.max(window.length, 1),
    marketCap: null,
    peRatio: null,
    sector: entry?.sector ?? null,
    industry: null,
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Local universe search — instant, exhaustive, and works with zero network.
 *
 * This runs over all ~3,150 listed NSE names, which is the whole point: the
 * previous version searched a hand-written list of 110 large caps, so anything
 * outside it simply did not exist as far as the UI was concerned.
 */
function localSearch(query: string, limit: number): SearchResult[] {
  return searchUniverse(query, limit).map((u) => ({
    symbol: u.symbol,
    name: u.name,
    exchange: "NSE",
    type: u.kind === "etf" ? "ETF" : u.kind === "sme" ? "SME" : "Equity",
  }));
}

export async function search(query: string, limit = 12): Promise<Sourced<SearchResult[]>> {
  const trimmed = query.trim();
  if (!trimmed) return { data: [], origin: "live", fetchedAt: stamp() };

  const key = `search:${trimmed.toLowerCase()}:${limit}`;
  const cached = cacheGet<Sourced<SearchResult[]>>(key);
  if (cached) return cached;

  // Search is entirely local. It needs no network, cannot be rate limited, and
  // covers every listed name, so there is nothing an upstream call would add.
  const results = localSearch(trimmed, limit);

  const result: Sourced<SearchResult[]> = {
    data: results,
    origin: "live",
    notice: results.length === 0 ? `No NSE symbol matches “${trimmed}”.` : undefined,
    fetchedAt: stamp(),
  };
  return remember(key, result, TTL.search);
}

// ---------------------------------------------------------------------------
// Fundamentals
// ---------------------------------------------------------------------------

function fyLabel(endDate: string): string {
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return endDate;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  // Indian fiscal year ends in March.
  const fy = month <= 2 ? year : year + 1;
  return `FY${String(fy).slice(2)}`;
}

function quarterLabel(endDate: string): string {
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return endDate;
  const month = d.getUTCMonth();
  const q = Math.floor(((month + 9) % 12) / 3) + 1;
  const year = month <= 2 ? d.getUTCFullYear() : d.getUTCFullYear() + 1;
  return `Q${q} FY${String(year).slice(2)}`;
}

function toIsoDate(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v * 1000).toISOString().slice(0, 10);
  if (v && typeof v === "object" && "raw" in v) {
    const raw = (v as { raw?: number }).raw;
    if (typeof raw === "number") return new Date(raw * 1000).toISOString().slice(0, 10);
  }
  if (typeof v === "string") return v;
  return "";
}

function safeDiv(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

function cagr(latest: number | null, earliest: number | null, years: number): number | null {
  if (latest === null || earliest === null || earliest <= 0 || latest <= 0 || years <= 0) return null;
  const r = (Math.pow(latest / earliest, 1 / years) - 1) * 100;
  return Number.isFinite(r) ? r : null;
}

export async function getFundamentals(rawSymbol: string): Promise<Sourced<FundamentalSnapshot>> {
  const symbol = normalizeSymbol(rawSymbol);
  const key = `fund:${symbol}`;

  const cached = cacheGet<Sourced<FundamentalSnapshot>>(key);
  if (cached) return cached;

  if (!forceSample()) {
    const summary = await fetchQuoteSummary(symbol);
    const incomeRows = summary?.incomeStatementHistory?.incomeStatementHistory ?? [];
    const balanceRows = summary?.balanceSheetHistory?.balanceSheetStatements ?? [];

    // Require at least a couple of annual statements for the analysis to mean anything.
    if (summary && incomeRows.length >= 2) {
      const annual: FinancialPeriod[] = incomeRows
        .map((row) => {
          const endDate = toIsoDate(row.endDate);
          const revenue = num(row.totalRevenue);
          const operatingProfit = num(row.operatingIncome) ?? num(row.ebit);
          const netProfit = num(row.netIncome);
          return {
            label: fyLabel(endDate),
            endDate,
            revenue,
            operatingProfit,
            netProfit,
            eps: null,
            operatingMargin: revenue ? safeDiv(operatingProfit, revenue) !== null ? (operatingProfit! / revenue) * 100 : null : null,
            netMargin: revenue && netProfit !== null ? (netProfit / revenue) * 100 : null,
          };
        })
        .filter((p) => p.endDate)
        .sort((a, b) => a.endDate.localeCompare(b.endDate));

      const quarterly: FinancialPeriod[] = (
        summary.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? []
      )
        .map((row) => {
          const endDate = toIsoDate(row.endDate);
          const revenue = num(row.totalRevenue);
          const operatingProfit = num(row.operatingIncome) ?? num(row.ebit);
          const netProfit = num(row.netIncome);
          return {
            label: quarterLabel(endDate),
            endDate,
            revenue,
            operatingProfit,
            netProfit,
            eps: null,
            operatingMargin: revenue && operatingProfit !== null ? (operatingProfit / revenue) * 100 : null,
            netMargin: revenue && netProfit !== null ? (netProfit / revenue) * 100 : null,
          };
        })
        .filter((p) => p.endDate)
        .sort((a, b) => a.endDate.localeCompare(b.endDate));

      const balanceSheet: BalanceSheetPeriod[] = balanceRows
        .map((row) => {
          const endDate = toIsoDate(row.endDate);
          const longTerm = num(row.longTermDebt) ?? 0;
          const shortTerm = num(row.shortLongTermDebt) ?? 0;
          const totalDebt = longTerm + shortTerm || null;
          return {
            label: fyLabel(endDate),
            endDate,
            totalAssets: num(row.totalAssets),
            totalLiabilities: num(row.totalLiab),
            totalEquity: num(row.totalStockholderEquity),
            totalDebt,
            cash: num(row.cash),
            currentAssets: num(row.totalCurrentAssets),
            currentLiabilities: num(row.totalCurrentLiabilities),
            inventory: num(row.inventory),
            receivables: num(row.netReceivables),
          };
        })
        .filter((p) => p.endDate)
        .sort((a, b) => a.endDate.localeCompare(b.endDate));

      const cashFlow: CashFlowPeriod[] = (summary.cashflowStatementHistory?.cashflowStatements ?? [])
        .map((row) => {
          const endDate = toIsoDate(row.endDate);
          const ocf = num(row.totalCashFromOperatingActivities);
          const capex = num(row.capitalExpenditures);
          return {
            label: fyLabel(endDate),
            endDate,
            operatingCashFlow: ocf,
            investingCashFlow: num(row.totalCashflowsFromInvestingActivities),
            financingCashFlow: num(row.totalCashFromFinancingActivities),
            capex,
            freeCashFlow: ocf !== null && capex !== null ? ocf + capex : null,
          };
        })
        .filter((p) => p.endDate)
        .sort((a, b) => a.endDate.localeCompare(b.endDate));

      const fd = summary.financialData;
      const ks = summary.defaultKeyStatistics;
      const sd = summary.summaryDetail;
      const mh = summary.majorHoldersBreakdown;

      const latestAnnual = annual[annual.length - 1];
      const latestBs = balanceSheet[balanceSheet.length - 1];
      const insiders = num(mh?.insidersPercentHeld);
      const institutions = num(mh?.institutionsPercentHeld);

      const n = annual.length;
      const rev = latestAnnual?.revenue ?? null;
      const profit = latestAnnual?.netProfit ?? null;

      const snapshot: FundamentalSnapshot = {
        symbol,
        name: summary.price?.longName ?? summary.price?.shortName ?? displaySymbol(symbol),
        sector: summary.assetProfile?.sector ?? findInUniverse(symbol)?.sector ?? null,
        industry: summary.assetProfile?.industry ?? null,
        currency: summary.price?.currency ?? "INR",
        annual,
        quarterly,
        balanceSheet,
        cashFlow,
        shareholding: {
          promoter: insiders !== null ? insiders * 100 : null,
          fii: null,
          dii: null,
          public:
            insiders !== null && institutions !== null
              ? Math.max(0, 100 - insiders * 100 - institutions * 100)
              : null,
          insider: insiders !== null ? insiders * 100 : null,
          institutions: institutions !== null ? institutions * 100 : null,
          pledgedPercent: null,
          asOf: null,
        },
        valuation: {
          peRatio: num(sd?.trailingPE),
          forwardPe: num(sd?.forwardPE) ?? num(ks?.forwardPE),
          priceToBook: num(ks?.priceToBook),
          priceToSales: num(sd?.priceToSalesTrailing12Months),
          evToEbitda: num(ks?.enterpriseToEbitda),
          pegRatio: num(ks?.pegRatio),
          dividendYield: num(sd?.dividendYield) !== null ? num(sd?.dividendYield)! * 100 : null,
          earningsYield: num(sd?.trailingPE) ? (1 / num(sd!.trailingPE)!) * 100 : null,
          marketCap: num(summary.price?.marketCap) ?? num(sd?.marketCap),
          enterpriseValue: num(ks?.enterpriseValue),
        },
        ratios: {
          roe: num(fd?.returnOnEquity) !== null ? num(fd!.returnOnEquity)! * 100 : null,
          roa: num(fd?.returnOnAssets) !== null ? num(fd!.returnOnAssets)! * 100 : null,
          roce:
            latestAnnual?.operatingProfit != null && latestBs
              ? safeDiv(
                  latestAnnual.operatingProfit,
                  (latestBs.totalEquity ?? 0) + (latestBs.totalDebt ?? 0),
                ) !== null
                ? safeDiv(latestAnnual.operatingProfit, (latestBs.totalEquity ?? 0) + (latestBs.totalDebt ?? 0))! * 100
                : null
              : null,
          debtToEquity: num(fd?.debtToEquity) !== null ? num(fd!.debtToEquity)! / 100 : null,
          currentRatio: num(fd?.currentRatio),
          quickRatio: num(fd?.quickRatio),
          interestCoverage: null,
          grossMargin: num(fd?.grossMargins) !== null ? num(fd!.grossMargins)! * 100 : null,
          operatingMargin: num(fd?.operatingMargins) !== null ? num(fd!.operatingMargins)! * 100 : null,
          netMargin: num(fd?.profitMargins) !== null ? num(fd!.profitMargins)! * 100 : null,
          assetTurnover: latestBs ? safeDiv(rev, latestBs.totalAssets) : null,
        },
        growth: {
          revenueCagr3y: n >= 4 ? cagr(rev, annual[n - 4].revenue, 3) : null,
          revenueCagr5y: n >= 5 ? cagr(rev, annual[0].revenue, n - 1) : null,
          profitCagr3y: n >= 4 ? cagr(profit, annual[n - 4].netProfit, 3) : null,
          profitCagr5y: n >= 5 ? cagr(profit, annual[0].netProfit, n - 1) : null,
          revenueYoy:
            n >= 2 && rev !== null && annual[n - 2].revenue
              ? (rev / annual[n - 2].revenue!) * 100 - 100
              : num(fd?.revenueGrowth) !== null
                ? num(fd!.revenueGrowth)! * 100
                : null,
          profitYoy:
            n >= 2 && profit !== null && annual[n - 2].netProfit
              ? (profit / annual[n - 2].netProfit!) * 100 - 100
              : num(fd?.earningsGrowth) !== null
                ? num(fd!.earningsGrowth)! * 100
                : null,
          epsGrowthYoy: num(ks?.earningsQuarterlyGrowth) !== null ? num(ks!.earningsQuarterlyGrowth)! * 100 : null,
        },
      };

      const result: Sourced<FundamentalSnapshot> = {
        data: snapshot,
        origin: "live",
        provider: "yahoo",
        fetchedAt: stamp(),
      };
      cacheSet(key, result, TTL.fundamentals);
      return result;
    }
  }

  const result: Sourced<FundamentalSnapshot> = {
    data: sampleFundamentals(symbol),
    origin: "sample",
    provider: "sample",
    notice: FUNDAMENTAL_SAMPLE_NOTICE,
    fetchedAt: stamp(),
  };
  // Short TTL for the same reason as history: a throttled upstream should not
  // pin the page to generated numbers for six hours.
  cacheSet(key, result, 2 * 60 * 1000);
  return result;
}

// ---------------------------------------------------------------------------
// Bulk loading for the screener
// ---------------------------------------------------------------------------

/**
 * Fetch history for many symbols with bounded concurrency.
 * Bounded because unbounded Promise.all over 100+ symbols reliably trips
 * upstream rate limits and serverless timeouts.
 */
/**
 * Read history from the cache only, never from the network.
 *
 * A bulk scan needs to know which symbols are already warm before it decides
 * how to spend its time budget. Calling `getHistory` to find out would defeat
 * the purpose, so this peeks instead.
 */
export function peekHistory(
  rawSymbol: string,
  timeframe: Timeframe = "daily",
  range = "2y",
): Sourced<Candle[]> | undefined {
  const symbol = normalizeSymbol(rawSymbol);
  return cacheGet<Sourced<Candle[]>>(`hist:${symbol}:${timeframe}:${range}`);
}

export interface BatchOptions {
  timeframe?: Timeframe;
  range?: string;
  concurrency?: number;
  /**
   * Stop starting new fetches once this many milliseconds have elapsed.
   *
   * Angel One allows three history requests per second, so a full-universe
   * scan takes many minutes — far longer than any serverless invocation is
   * allowed to run. Rather than timing out and returning nothing, a scan
   * spends a fixed budget, returns what it has, and leaves the rest cached for
   * next time. Successive runs converge on a complete scan.
   */
  budgetMs?: number;
}

export interface BatchOutcome {
  histories: Map<string, Sourced<Candle[]>>;
  /** Symbols served from cache without touching the network. */
  fromCache: number;
  /** Symbols fetched during this call. */
  fetched: number;
  /** Symbols skipped because the time budget ran out. */
  skipped: number;
}

/**
 * Fetch many histories, respecting a wall-clock budget.
 *
 * Symbols already in cache are collected first and cost nothing, so a warm
 * cache completes instantly regardless of universe size.
 */
export async function getHistoryBatchBudgeted(
  symbols: string[],
  { timeframe = "daily", range = "2y", concurrency = 4, budgetMs = 45_000 }: BatchOptions = {},
): Promise<BatchOutcome> {
  const histories = new Map<string, Sourced<Candle[]>>();
  const pending: string[] = [];
  const startedAt = Date.now();

  // Pass one: everything already warm, at no cost.
  for (const symbol of symbols) {
    const cached = peekHistory(symbol, timeframe, range);
    if (cached) histories.set(symbol, cached);
    else pending.push(symbol);
  }
  const fromCache = histories.size;

  let cursor = 0;
  let fetched = 0;

  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      if (Date.now() - startedAt >= budgetMs) return;

      const symbol = pending[cursor];
      cursor += 1;

      try {
        histories.set(symbol, await getHistory(symbol, timeframe, range));
      } catch {
        histories.set(symbol, {
          data: sampleCandles(symbol, timeframe, 2),
          origin: "sample",
          provider: "sample",
          notice: SAMPLE_NOTICE,
          fetchedAt: stamp(),
        });
      }
      fetched += 1;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(pending.length, 1)) }, worker),
  );

  return { histories, fromCache, fetched, skipped: pending.length - fetched };
}

export async function getHistoryBatch(
  symbols: string[],
  timeframe: Timeframe = "daily",
  range = "2y",
  concurrency = 8,
): Promise<Map<string, Sourced<Candle[]>>> {
  const out = new Map<string, Sourced<Candle[]>>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < symbols.length) {
      const index = cursor;
      cursor += 1;
      const symbol = symbols[index];
      try {
        out.set(symbol, await getHistory(symbol, timeframe, range));
      } catch {
        out.set(symbol, {
          data: sampleCandles(symbol, timeframe, 2),
          origin: "sample",
          provider: "sample",
          notice: SAMPLE_NOTICE,
          fetchedAt: stamp(),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));
  return out;
}

export { SAMPLE_NOTICE, FUNDAMENTAL_SAMPLE_NOTICE };
