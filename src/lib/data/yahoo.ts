import "server-only";
import { buildCookieJar } from "./cookie-jar";
import {
  attemptsFor,
  isCircuitOpen,
  recordFailure,
  recordSuccess,
  type ProviderName,
} from "./circuit";

/**
 * Yahoo Finance client — fundamentals only.
 *
 * Prices come from Angel One. This module exists because SmartAPI is an
 * execution API: it serves candles and quotes but carries no balance sheets,
 * cash flows or ratios. Yahoo's `quoteSummary` is the remaining free source
 * for those, so it stays for the fundamentals page and nothing else.
 *
 * `quoteSummary` rejects any request without a session cookie AND a matching
 * "crumb" token, so this establishes one, caches it, and retries with backoff
 * when throttled. Everything fails soft: the fundamentals page falls back to
 * clearly-labelled sample figures rather than breaking.
 */

const BASE = "https://query1.finance.yahoo.com";
const BASE_ALT = "https://query2.finance.yahoo.com";
/**
 * Yahoo is a best-effort fundamentals fallback, never a blocking dependency.
 *
 * The old nine-second timeout, multiplied by three attempts across two hosts
 * plus two session-establishment calls, gave a worst case near forty seconds —
 * all of it in front of a page render. `quoteSummary` also answers 401 or 429
 * to most datacenter IPs, which is exactly what a Vercel function is, so that
 * worst case was the common case in production rather than the rare one.
 *
 * Four seconds is long enough for a host that is going to answer and short
 * enough that a host that is not costs almost nothing.
 */
const TIMEOUT_MS = 4_000;

/**
 * Total wall-clock budget for one fundamentals lookup, across every attempt
 * and both hosts. Whatever is unfinished when this expires is abandoned.
 */
const TOTAL_BUDGET_MS = 6_500;

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Why a fetch produced nothing. Surfaced so the UI can tell the truth. */
export type FetchFailure = "throttled" | "unauthorized" | "not-found" | "network" | "malformed";

// ---------------------------------------------------------------------------
// Cookie + crumb session
// ---------------------------------------------------------------------------

interface Session {
  cookie: string;
  crumb: string;
  expires: number;
}

let session: Session | null = null;
let sessionInFlight: Promise<Session | null> | null = null;

const SESSION_TTL_MS = 55 * 60 * 1000;

async function establishSession(): Promise<Session | null> {
  try {
    // Any Yahoo Finance page will hand out the consent cookie we need.
    const seed = await fetch("https://fc.yahoo.com", {
      headers: HEADERS,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);

    // This previously kept only the first of the cookies Yahoo sets, because
    // it joined them all into one string before splitting. `getcrumb` then
    // answered 401, the crumb never arrived, and the fundamentals page fell
    // through to sample data — a failure that reads as an IP block and is not
    // one. Worth checking here first whenever fundamentals go quiet.
    const cookie = seed ? buildCookieJar(seed.headers) : "";
    if (!cookie) return null;

    const crumbRes = await fetch(`${BASE_ALT}/v1/test/getcrumb`, {
      headers: { ...HEADERS, Cookie: cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!crumbRes.ok) return null;

    const crumb = (await crumbRes.text()).trim();
    // A valid crumb is a short opaque token. HTML means we got a consent page.
    if (!crumb || crumb.length > 32 || crumb.includes("<")) return null;

    return { cookie, crumb, expires: Date.now() + SESSION_TTL_MS };
  } catch {
    return null;
  }
}

/** Get a cached session, establishing one if needed. Concurrent callers share. */
async function getSession(): Promise<Session | null> {
  if (session && Date.now() < session.expires) return session;
  if (sessionInFlight) return sessionInFlight;

  sessionInFlight = establishSession()
    .then((s) => {
      session = s;
      return s;
    })
    .finally(() => {
      sessionInFlight = null;
    });

  return sessionInFlight;
}

// --- Minimal structural types for the slices of Yahoo's payload we consume ---







type RawValue = { raw?: number | null } | number | null | undefined;

interface YStatement {
  endDate?: RawValue;
  totalRevenue?: RawValue;
  operatingIncome?: RawValue;
  netIncome?: RawValue;
  grossProfit?: RawValue;
  ebit?: RawValue;
  interestExpense?: RawValue;
  costOfRevenue?: RawValue;
  totalAssets?: RawValue;
  totalLiab?: RawValue;
  totalStockholderEquity?: RawValue;
  cash?: RawValue;
  shortTermInvestments?: RawValue;
  totalCurrentAssets?: RawValue;
  totalCurrentLiabilities?: RawValue;
  inventory?: RawValue;
  netReceivables?: RawValue;
  longTermDebt?: RawValue;
  shortLongTermDebt?: RawValue;
  totalCashFromOperatingActivities?: RawValue;
  totalCashflowsFromInvestingActivities?: RawValue;
  totalCashFromFinancingActivities?: RawValue;
  capitalExpenditures?: RawValue;
}

export interface YahooQuoteSummary {
  assetProfile?: { sector?: string; industry?: string; longBusinessSummary?: string };
  price?: {
    longName?: string;
    shortName?: string;
    symbol?: string;
    currency?: string;
    exchangeName?: string;
    marketCap?: RawValue;
    regularMarketPrice?: RawValue;
    regularMarketChangePercent?: RawValue;
  };
  summaryDetail?: {
    trailingPE?: RawValue;
    forwardPE?: RawValue;
    priceToSalesTrailing12Months?: RawValue;
    dividendYield?: RawValue;
    marketCap?: RawValue;
    averageVolume?: RawValue;
    fiftyTwoWeekHigh?: RawValue;
    fiftyTwoWeekLow?: RawValue;
  };
  defaultKeyStatistics?: {
    forwardPE?: RawValue;
    priceToBook?: RawValue;
    enterpriseToEbitda?: RawValue;
    enterpriseToRevenue?: RawValue;
    pegRatio?: RawValue;
    enterpriseValue?: RawValue;
    trailingEps?: RawValue;
    heldPercentInsiders?: RawValue;
    heldPercentInstitutions?: RawValue;
    earningsQuarterlyGrowth?: RawValue;
  };
  financialData?: {
    returnOnEquity?: RawValue;
    returnOnAssets?: RawValue;
    debtToEquity?: RawValue;
    currentRatio?: RawValue;
    quickRatio?: RawValue;
    grossMargins?: RawValue;
    operatingMargins?: RawValue;
    profitMargins?: RawValue;
    ebitdaMargins?: RawValue;
    revenueGrowth?: RawValue;
    earningsGrowth?: RawValue;
    totalDebt?: RawValue;
    totalCash?: RawValue;
    totalRevenue?: RawValue;
    ebitda?: RawValue;
    freeCashflow?: RawValue;
    operatingCashflow?: RawValue;
  };
  incomeStatementHistory?: { incomeStatementHistory?: YStatement[] };
  balanceSheetHistory?: { balanceSheetStatements?: YStatement[] };
  cashflowStatementHistory?: { cashflowStatements?: YStatement[] };
  incomeStatementHistoryQuarterly?: { incomeStatementHistory?: YStatement[] };
  majorHoldersBreakdown?: {
    insidersPercentHeld?: RawValue;
    institutionsPercentHeld?: RawValue;
    institutionsFloatPercentHeld?: RawValue;
  };
  earnings?: {
    financialsChart?: {
      yearly?: { date?: number; revenue?: RawValue; earnings?: RawValue }[];
      quarterly?: { date?: string; revenue?: RawValue; earnings?: RawValue }[];
    };
  };
}

interface YQuoteSummaryResponse {
  quoteSummary?: { result?: YahooQuoteSummary[]; error?: unknown };
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch JSON with bounded retries.
 *
 * Retries only on throttling and transient server errors — retrying a 404
 * would just waste the execution budget. `withSession` adds the cookie/crumb
 * pair that quoteSummary requires.
 */
async function getJson<T>(
  url: string,
  opts: { withSession?: boolean; provider?: ProviderName; deadline?: number } = {},
): Promise<{ data: T } | { error: FetchFailure }> {
  const provider = opts.provider;

  // If this provider has been failing repeatedly, do not spend the request
  // budget finding out again. Bulk scans depend on this returning instantly.
  if (provider && isCircuitOpen(provider)) return { error: "throttled" };

  // Two attempts, not three. A third attempt against a host that has already
  // refused twice has never recovered the request; it only spends the budget.
  const attempts = Math.min(provider ? attemptsFor(provider) : 2, 2);
  const deadline = opts.deadline ?? Date.now() + TOTAL_BUDGET_MS;
  let last: FetchFailure = "network";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (Date.now() >= deadline) {
      if (provider) recordFailure(provider);
      return { error: last };
    }
    let target = url;
    const headers: Record<string, string> = { ...HEADERS };

    if (opts.withSession) {
      const s = await getSession();
      if (s) {
        headers.Cookie = s.cookie;
        target += `${url.includes("?") ? "&" : "?"}crumb=${encodeURIComponent(s.crumb)}`;
      }
    }

    try {
      const res = await fetch(target, {
        headers,
        signal: AbortSignal.timeout(Math.max(500, Math.min(TIMEOUT_MS, deadline - Date.now()))),
        // Swing and positional analysis does not need data live to the second,
        // and an hour of caching is what keeps a flaky upstream from being hit
        // once per page view.
        next: { revalidate: 3_600 },
      });

      if (res.status === 429 || res.status === 503) {
        last = "throttled";
        await sleep(400 * 2 ** attempt);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        last = "unauthorized";
        // A stale crumb is the usual cause — drop it and let the next attempt
        // establish a fresh session.
        session = null;
        await sleep(250);
        continue;
      }
      if (res.status === 404) {
        // A missing symbol says nothing about provider health.
        if (provider) recordSuccess(provider);
        return { error: "not-found" };
      }
      if (!res.ok) {
        last = "network";
        await sleep(250 * 2 ** attempt);
        continue;
      }

      const text = await res.text();
      if (!text || text.trim().startsWith("<")) {
        last = "malformed";
        continue;
      }
      if (provider) recordSuccess(provider);
      return { data: JSON.parse(text) as T };
    } catch {
      last = "network";
      await sleep(250 * 2 ** attempt);
    }
  }

  if (provider) recordFailure(provider);
  return { error: last };
}

function unwrap<T>(r: { data: T } | { error: FetchFailure }): T | null {
  return "data" in r ? r.data : null;
}

/** Unwrap Yahoo's `{ raw: n }` / bare-number / null union into number | null. */
export function num(v: RawValue): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const raw = v.raw;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The modules the fundamentals page consumes. Requesting only these keeps the
 * payload small and means a schema change in an unused module cannot break us.
 */
const ALL_MODULES = [
  "assetProfile",
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "incomeStatementHistory",
  "incomeStatementHistoryQuarterly",
  "balanceSheetHistory",
  "balanceSheetHistoryQuarterly",
  "cashflowStatementHistory",
  "cashflowStatementHistoryQuarterly",
  "earnings",
] as const;

/** Fetch the fundamentals payload for a symbol. */
export async function fetchQuoteSummary(
  symbol: string,
  modules: readonly string[] = ALL_MODULES,
): Promise<YahooQuoteSummary | null> {
  const mods = modules.join("%2C");
  const path = `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${mods}`;
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  // quoteSummary is the endpoint that hard-requires a cookie + crumb.
  let json = unwrap(
    await getJson<YQuoteSummaryResponse>(`${BASE_ALT}${path}`, {
      withSession: true,
      provider: "yahoo-summary",
      deadline,
    }),
  );

  // Only try the second host if there is budget left for it to matter.
  if (!json?.quoteSummary?.result?.length && Date.now() < deadline) {
    json = unwrap(
      await getJson<YQuoteSummaryResponse>(`${BASE}${path}`, {
        withSession: true,
        provider: "yahoo-summary",
        deadline,
      }),
    );
  }
  return json?.quoteSummary?.result?.[0] ?? null;
}
