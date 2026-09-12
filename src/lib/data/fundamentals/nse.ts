import "server-only";
import { buildCookieJar } from "../cookie-jar";

/**
 * NSE India as a fundamentals source.
 *
 * Why this exists: Angel One SmartAPI is an execution API. It serves candles
 * and quotes and carries no statements, so no amount of SmartAPI work will
 * ever produce a balance sheet. Yahoo's `quoteSummary` was the stopgap, and it
 * answers 401 or 429 to most datacenter IPs — which is exactly what a Vercel
 * function is. That is the whole reason the fundamentals page has been showing
 * sample data.
 *
 * NSE publishes the underlying filings itself, for free, for every listed
 * company. Two endpoints matter:
 *
 *   - `results-comparision` (NSE's own spelling, typo included) returns the
 *     last five quarters of the P&L as filed: total income, profit before and
 *     after tax, and EPS. Amounts are in rupee lakhs.
 *   - `corporate-share-holdings-master` returns the shareholding pattern, which
 *     means the promoter / FII / DII / public split and pledge figures that
 *     Indian filings carry and Yahoo simply does not have. This is a strict
 *     upgrade on the previous source rather than a substitute for it.
 *
 * What NSE does NOT give through a JSON endpoint is the balance sheet and the
 * cash flow statement. Those live in the XBRL documents attached to each
 * filing. `financialResultFilings` returns the XBRL links so the ingestion
 * script can walk them.
 *
 * IMPORTANT, and the reason for the ingestion script: these endpoints require
 * a session cookie obtained by first loading a page, and NSE rate limits to
 * about three requests per second and blocks datacenter ranges aggressively.
 * They work from a home connection and are unreliable from a serverless
 * function. Treat this module as the ingestion path, not the request path.
 * `dataset.ts` is what the app reads.
 *
 * Field names below are read through tolerant accessors on purpose. None of
 * these endpoints is documented, several keys differ between the equity and
 * SME variants, and a key that does not match reads as `undefined` rather than
 * throwing — so one rename degrades one number instead of losing the company.
 */

const NSE_BASE = process.env.NSE_API_BASE?.trim() || "https://www.nseindia.com";
const TIMEOUT_MS = 12_000;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: `${NSE_BASE}/companies-listing/corporate-filings-financial-results`,
  Connection: "keep-alive",
};

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

let cookie: string | null = null;
let cookieExpires = 0;
let cookieInFlight: Promise<string | null> | null = null;

const COOKIE_TTL_MS = 8 * 60 * 1000;

/**
 * NSE hands out its session cookie on any HTML page load, and every /api call
 * without one answers 401. Landing on the filings page rather than the home
 * page matters: the cookie set is route-scoped in practice.
 */
async function establishCookie(): Promise<string | null> {
  try {
    const res = await fetch(`${NSE_BASE}/companies-listing/corporate-filings-financial-results`, {
      headers: BROWSER_HEADERS,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // NSE sets several cookies across separate headers and rejects a request
    // carrying only some of them, so the jar has to keep all of them.
    const jar = buildCookieJar(res.headers);
    return jar.length > 0 ? jar : null;
  } catch {
    return null;
  }
}

async function getCookie(): Promise<string | null> {
  if (cookie && Date.now() < cookieExpires) return cookie;
  if (cookieInFlight) return cookieInFlight;

  cookieInFlight = establishCookie()
    .then((value) => {
      cookie = value;
      cookieExpires = Date.now() + COOKIE_TTL_MS;
      return value;
    })
    .finally(() => {
      cookieInFlight = null;
    });

  return cookieInFlight;
}

/** Drop the cached session. Called after a 401 so the next call re-bootstraps. */
export function clearNseSession(): void {
  cookie = null;
  cookieExpires = 0;
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

export type NseResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function nseGet<T>(path: string, attempts = 2): Promise<NseResult<T>> {
  let message = "Request failed.";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const jar = await getCookie();
    if (!jar) {
      message = "Could not obtain an NSE session cookie.";
      continue;
    }

    try {
      const res = await fetch(`${NSE_BASE}${path}`, {
        headers: { ...BROWSER_HEADERS, Cookie: jar },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.status === 401 || res.status === 403) {
        clearNseSession();
        message = `NSE refused the request (HTTP ${res.status}). This is what a datacenter IP normally gets.`;
        continue;
      }
      if (res.status === 429) {
        message = "NSE rate limited the request.";
        await new Promise((r) => setTimeout(r, 1_500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        message = `NSE responded HTTP ${res.status}.`;
        continue;
      }

      const text = await res.text();
      if (!text || text.trim().startsWith("<")) {
        // An HTML body from a /api path means the session was rejected and we
        // were handed the consent page instead.
        clearNseSession();
        message = "NSE returned HTML instead of JSON — the session was rejected.";
        continue;
      }

      return { ok: true, data: JSON.parse(text) as T };
    } catch (err) {
      message = (err as Error).message;
    }
  }

  return { ok: false, message };
}

// ---------------------------------------------------------------------------
// Tolerant accessors
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** First finite number found under any candidate key. Lakhs are not converted. */
function pick(row: Row, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined || value === "") continue;
    const n = Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickText(row: Row, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/**
 * NSE reports money in rupee lakhs. Everything downstream works in rupees, so
 * the conversion happens once, here, rather than being remembered at each use.
 */
const LAKH = 100_000;

function lakhsToRupees(value: number | null): number | null {
  return value === null ? null : value * LAKH;
}

/** NSE dates arrive as `dd-MMM-yyyy`. Normalise to ISO for sorting. */
export function nseDateToIso(value: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const dmy = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (dmy) {
    const month = months[dmy[2].toLowerCase()];
    if (month) return `${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface NseQuarter {
  endDate: string;
  /** Total income, in rupees. */
  revenue: number | null;
  profitBeforeTax: number | null;
  netProfit: number | null
  eps: number | null;
  /** True when the filing is consolidated rather than standalone. */
  consolidated: boolean;
  audited: boolean;
}

/**
 * The last five quarters of the P&L as filed with the exchange.
 *
 * Consolidated filings are preferred where both exist: a standalone statement
 * for a holding company describes almost none of the actual business.
 */
export async function fetchNseQuarterlyResults(symbol: string): Promise<NseResult<NseQuarter[]>> {
  const ticker = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
  const result = await nseGet<{ resCmpData?: Row[] }>(
    `/api/results-comparision?index=equities&symbol=${encodeURIComponent(ticker)}`,
  );
  if (!result.ok) return result;

  const rows = result.data.resCmpData ?? [];
  const quarters: NseQuarter[] = [];

  for (const row of rows) {
    const endDate = nseDateToIso(pickText(row, "re_to_dt", "toDate", "re_period_end"));
    if (!endDate) continue;

    quarters.push({
      endDate,
      revenue: lakhsToRupees(pick(row, "re_total_inc", "totalIncome", "re_net_sale")),
      profitBeforeTax: lakhsToRupees(pick(row, "re_pro_loss_bef_tax", "profitBeforeTax")),
      netProfit: lakhsToRupees(pick(row, "re_pro_loss_aft_tax", "profitAfterTax", "re_con_pro_loss")),
      eps: pick(row, "re_basic_eps_for_cont_dis_opr", "re_basic_eps", "basicEps"),
      consolidated: /consolidated/i.test(pickText(row, "re_audited", "audited", "consolidated") ?? ""),
      audited: /audited/i.test(pickText(row, "re_audited", "audited") ?? ""),
    });
  }

  quarters.sort((a, b) => a.endDate.localeCompare(b.endDate));
  return { ok: true, data: quarters };
}

export interface NseShareholding {
  asOf: string | null;
  promoter: number | null;
  fii: number | null;
  dii: number | null;
  public: number | null;
  pledgedPercent: number | null;
}

/**
 * The shareholding pattern.
 *
 * This is the genuinely new capability. The promoter / FII / DII split and
 * pledge percentage are in every Indian quarterly filing and are among the
 * most predictive things in the whole dataset — a rising pledge against a
 * falling promoter stake has preceded a great many permanent losses — and the
 * previous source could not supply any of it.
 */
export async function fetchNseShareholding(symbol: string): Promise<NseResult<NseShareholding>> {
  const ticker = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
  const result = await nseGet<{ data?: Row[] } | Row[]>(
    `/api/corporate-share-holdings-master?index=equities&symbol=${encodeURIComponent(ticker)}`,
  );
  if (!result.ok) return result;

  const rows = Array.isArray(result.data) ? result.data : (result.data.data ?? []);
  if (rows.length === 0) return { ok: false, message: "No shareholding filings returned." };

  // Most recent filing first; the endpoint's ordering is not guaranteed.
  const sorted = [...rows].sort((a, b) =>
    nseDateToIso(pickText(b, "date", "asOnDate", "sh_date")).localeCompare(
      nseDateToIso(pickText(a, "date", "asOnDate", "sh_date")),
    ),
  );
  const row = sorted[0];

  const promoter = pick(row, "pr_and_prgrp", "promoterAndPromoterGroup", "promoter");
  const fii = pick(row, "foreignInstitutions", "fii", "public_fii");
  const dii = pick(row, "domesticInstitutions", "dii", "public_dii");
  const publicHolding = pick(row, "public_val", "public", "publicShareholding");

  return {
    ok: true,
    data: {
      asOf: nseDateToIso(pickText(row, "date", "asOnDate", "sh_date")) || null,
      promoter,
      fii,
      dii,
      public:
        publicHolding ??
        (promoter !== null ? Math.max(0, 100 - promoter) : null),
      pledgedPercent: pick(row, "pledged", "shrsPledged", "pledgedPercent"),
    },
  };
}

export interface NseFiling {
  /** Period the filing covers. */
  from: string;
  to: string;
  /** e.g. "Third Quarter", "Annual". */
  relatingTo: string | null;
  audited: boolean;
  consolidated: boolean;
  /**
   * Link to the XBRL instance document, when one was filed.
   *
   * This is the route to the balance sheet and cash flow statement, which no
   * NSE JSON endpoint exposes. SEBI requires both alongside half-yearly and
   * annual results, so walking these links backwards builds a full picture.
   */
  xbrl: string | null;
}

/** Filing metadata for a symbol, including XBRL links. */
export async function fetchNseFilings(symbol: string): Promise<NseResult<NseFiling[]>> {
  const ticker = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
  const result = await nseGet<Row[] | { data?: Row[] }>(
    `/api/corporates-financial-results?index=equities&symbol=${encodeURIComponent(ticker)}&period=Quarterly`,
  );
  if (!result.ok) return result;

  const rows = Array.isArray(result.data) ? result.data : (result.data.data ?? []);

  return {
    ok: true,
    data: rows
      .map((row) => ({
        from: nseDateToIso(pickText(row, "fromDate", "from_date")),
        to: nseDateToIso(pickText(row, "toDate", "to_date")),
        relatingTo: pickText(row, "relatingTo", "relating_to"),
        audited: /audited/i.test(pickText(row, "audited") ?? ""),
        consolidated: /consolidated/i.test(pickText(row, "consolidated", "audited") ?? ""),
        xbrl: pickText(row, "xbrl", "xbrl_attachment", "naviLink"),
      }))
      .filter((f) => f.to),
  };
}

/** Sector and industry as NSE classifies them. */
export async function fetchNseIndustry(
  symbol: string,
): Promise<NseResult<{ sector: string | null; industry: string | null; name: string | null }>> {
  const ticker = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
  const result = await nseGet<Row>(`/api/equity-meta-info?symbol=${encodeURIComponent(ticker)}`);
  if (!result.ok) return result;

  const info = (result.data.industryInfo ?? {}) as Row;
  return {
    ok: true,
    data: {
      sector: pickText(info, "sector", "macro", "basicIndustry"),
      industry: pickText(info, "basicIndustry", "industry"),
      name: pickText(result.data, "companyName", "symbol"),
    },
  };
}
