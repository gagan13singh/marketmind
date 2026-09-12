/**
 * Build data/fundamentals.json from NSE's own filings.
 *
 *   npm run ingest:fundamentals              # top 500 by turnover
 *   npm run ingest:fundamentals -- --all     # every listed equity
 *   npm run ingest:fundamentals -- --limit 1200 --resume
 *
 * Run this from a machine NSE will actually talk to. That means a laptop on a
 * home connection, or a GitHub Actions runner, NOT a Vercel function — NSE
 * refuses most datacenter ranges, which is the whole reason this is an offline
 * step instead of a request-time fetch.
 *
 * It is resumable by design. NSE tolerates roughly three requests a second and
 * each company needs three calls, so the full universe is a long run: about
 * 3,150 companies at ~1.1 s each is a bit over an hour. `--resume` merges into
 * the existing file, so the run can be stopped and restarted freely, and a
 * partial dataset is immediately useful because the app falls back per symbol
 * rather than all or nothing.
 *
 * Everything is free. No API key, no account, no paid tier.
 */

import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data");
const OUT_FILE = path.join(OUT_DIR, "fundamentals.json");

// --- Arguments --------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= argv.length) return fallback;
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
};

const LIMIT = flag("all") ? Infinity : value("limit", 500);
const RESUME = flag("resume");
/** NSE tolerates ~3 req/s. One company costs three calls, so pace per company. */
const DELAY_MS = value("delay", 1_100);

// --- Load the universe ------------------------------------------------------

const { NSE_UNIVERSE } = await import("../src/lib/data/nse-universe.ts");
const nse = await import("../src/lib/data/fundamentals/nse.ts");

const candidates = NSE_UNIVERSE.filter((u) => u.kind === "equity").slice(
  0,
  LIMIT === Infinity ? undefined : LIMIT,
);

console.log(`Ingesting fundamentals for ${candidates.length} companies.`);
console.log(`Pacing at ${DELAY_MS} ms per company — estimated ${Math.ceil((candidates.length * DELAY_MS) / 60_000)} minutes.\n`);

// --- Resume -----------------------------------------------------------------

/** @type {{ builtAt: string, sources: string[], companies: Record<string, unknown> }} */
let dataset = { builtAt: new Date().toISOString(), sources: ["nseindia.com"], companies: {} };

if (RESUME) {
  try {
    dataset = JSON.parse(await readFile(OUT_FILE, "utf8"));
    console.log(`Resuming — ${Object.keys(dataset.companies).length} companies already present.\n`);
  } catch {
    console.log("Nothing to resume from; starting fresh.\n");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Derivations ------------------------------------------------------------

function quarterLabel(endDate) {
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return endDate;
  const month = d.getUTCMonth();
  const q = Math.floor(((month + 9) % 12) / 3) + 1;
  const year = month <= 2 ? d.getUTCFullYear() : d.getUTCFullYear() + 1;
  return `Q${q} FY${String(year).slice(2)}`;
}

const pct = (a, b) => (a === null || b === null || b === 0 ? null : (a / b) * 100);

/**
 * Roll four consecutive quarters into a trailing-twelve-month figure.
 *
 * NSE's JSON endpoints publish the quarterly P&L but no annual statement, so
 * the annual series here is TTM rather than as-filed. That is a real
 * difference and it is labelled: a TTM window ending in December is not FY.
 * It is still the right basis for growth and margin work, because it is what
 * a trailing ratio is computed from anyway.
 */
function toTtm(quarters) {
  const out = [];
  for (let i = 3; i < quarters.length; i += 1) {
    const window = quarters.slice(i - 3, i + 1);
    const sum = (key) =>
      window.every((q) => q[key] === null)
        ? null
        : window.reduce((a, q) => a + (q[key] ?? 0), 0);

    const revenue = sum("revenue");
    const netProfit = sum("netProfit");
    const operatingProfit = sum("profitBeforeTax");

    out.push({
      // Labelled by the quarter the window ENDS on, not the fiscal year it
      // falls in. Four consecutive TTM windows inside one fiscal year all
      // mapped to the same fiscal-year label, which put four identical column
      // headings on the statements table and told the reader nothing about
      // which period each column covered.
      label: `TTM to ${quarterLabel(window[3].endDate)}`,
      endDate: window[3].endDate,
      revenue,
      operatingProfit,
      netProfit,
      eps: sum("eps"),
      operatingMargin: pct(operatingProfit, revenue),
      netMargin: pct(netProfit, revenue),
    });
  }
  return out;
}

function cagr(latest, earliest, years) {
  if (latest === null || earliest === null || earliest <= 0 || latest <= 0 || years <= 0) return null;
  const r = (Math.pow(latest / earliest, 1 / years) - 1) * 100;
  return Number.isFinite(r) ? r : null;
}

/**
 * Assemble a FundamentalSnapshot from what NSE actually supplies.
 *
 * Anything NSE does not publish through JSON stays `null` rather than being
 * estimated. The analysis engine drops missing metrics and lowers confidence,
 * which is the correct behaviour — an invented balance sheet would score well
 * and mean nothing. Balance sheet and cash flow come from the XBRL documents
 * and are left for a follow-up pass; the filings' XBRL links are captured here
 * so that pass has somewhere to start.
 */
function buildSnapshot(entry, quarters, shareholding, industry) {
  const annual = toTtm(quarters);
  const n = annual.length;
  const latest = annual[n - 1] ?? null;
  const rev = latest?.revenue ?? null;
  const profit = latest?.netProfit ?? null;

  const prior = n >= 5 ? annual[n - 5] : null; // four quarters back = one year
  const oldest = annual[0] ?? null;

  return {
    symbol: entry.symbol,
    name: industry?.name ?? entry.name,
    sector: industry?.sector ?? entry.sector,
    industry: industry?.industry ?? null,
    currency: "INR",
    annual,
    quarterly: quarters.map((q) => ({
      label: quarterLabel(q.endDate),
      endDate: q.endDate,
      revenue: q.revenue,
      operatingProfit: q.profitBeforeTax,
      netProfit: q.netProfit,
      eps: q.eps,
      operatingMargin: pct(q.profitBeforeTax, q.revenue),
      netMargin: pct(q.netProfit, q.revenue),
    })),
    // Not available from NSE's JSON endpoints. Left empty rather than guessed.
    balanceSheet: [],
    cashFlow: [],
    shareholding: {
      promoter: shareholding?.promoter ?? null,
      fii: shareholding?.fii ?? null,
      dii: shareholding?.dii ?? null,
      public: shareholding?.public ?? null,
      insider: null,
      institutions:
        shareholding && (shareholding.fii !== null || shareholding.dii !== null)
          ? (shareholding.fii ?? 0) + (shareholding.dii ?? 0)
          : null,
      pledgedPercent: shareholding?.pledgedPercent ?? null,
      asOf: shareholding?.asOf ?? null,
    },
    valuation: {
      peRatio: null, forwardPe: null, priceToBook: null, priceToSales: null,
      evToEbitda: null, pegRatio: null, dividendYield: null, earningsYield: null,
      marketCap: null, enterpriseValue: null,
    },
    ratios: {
      roe: null, roa: null, roce: null, debtToEquity: null, currentRatio: null,
      quickRatio: null, interestCoverage: null, grossMargin: null,
      operatingMargin: latest?.operatingMargin ?? null,
      netMargin: latest?.netMargin ?? null,
      assetTurnover: null,
    },
    growth: {
      revenueCagr3y: null,
      revenueCagr5y: oldest ? cagr(rev, oldest.revenue, Math.max(1, (n - 1) / 4)) : null,
      profitCagr3y: null,
      profitCagr5y: oldest ? cagr(profit, oldest.netProfit, Math.max(1, (n - 1) / 4)) : null,
      revenueYoy: prior && rev !== null && prior.revenue ? (rev / prior.revenue) * 100 - 100 : null,
      profitYoy: prior && profit !== null && prior.netProfit ? (profit / prior.netProfit) * 100 - 100 : null,
      epsGrowthYoy: null,
    },
  };
}

// --- Run --------------------------------------------------------------------

let ok = 0;
let skipped = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < candidates.length; i += 1) {
  const entry = candidates[i];

  const alreadyHave = RESUME && Boolean(dataset.companies[entry.ticker]);

  if (!alreadyHave) {
    const quarters = await nse.fetchNseQuarterlyResults(entry.symbol);

    if (!quarters.ok || quarters.data.length < 2) {
      failed += 1;
      failures.push(`${entry.ticker}: ${quarters.ok ? "too few quarters filed" : quarters.message}`);
    } else {
      const [shareholding, industry] = await Promise.all([
        nse.fetchNseShareholding(entry.symbol),
        nse.fetchNseIndustry(entry.symbol),
      ]);

      dataset.companies[entry.ticker] = buildSnapshot(
        entry,
        quarters.data,
        shareholding.ok ? shareholding.data : null,
        industry.ok ? industry.data : null,
      );
      ok += 1;
    }
  } else {
    skipped += 1;
  }

  const done = i + 1;
  if (done % 25 === 0 || done === candidates.length) {
    // Printed on the skip path too, so a resumed run shows progress instead of
    // sitting silent while it walks past thousands of cached rows.
    const pctDone = ((done / candidates.length) * 100).toFixed(1);
    console.log(`  ${done}/${candidates.length} (${pctDone}%) — ${ok} written, ${skipped} skipped, ${failed} failed`);

    // Checkpoint as we go. A run interrupted at the ninety-minute mark should
    // not lose ninety minutes of work.
    dataset.builtAt = new Date().toISOString();
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(OUT_FILE, JSON.stringify(dataset), "utf8");
  }

  if (!alreadyHave) await sleep(DELAY_MS);
}

dataset.builtAt = new Date().toISOString();
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(dataset), "utf8");

console.log(`\nWrote ${Object.keys(dataset.companies).length} companies to data/fundamentals.json`);

if (failures.length > 0) {
  console.log(`\n${failures.length} companies could not be read. First few:`);
  for (const f of failures.slice(0, 10)) console.log(`  ${f}`);

  if (failures.filter((f) => /HTTP 40[13]|datacenter|HTML instead/.test(f)).length > failures.length / 2) {
    console.log(
      "\nMost failures are NSE refusing the connection. That is what happens from a\n" +
        "datacenter IP or a VPN. Run this from an ordinary home connection.",
    );
  }
}
