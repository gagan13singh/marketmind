import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Filter, Activity } from "lucide-react";
import { getHistoryBatchBudgeted } from "@/lib/data/service";
import { analyzeTechnical } from "@/lib/analysis/technical";
import { UNIVERSE_SIZE, displaySymbol, BENCHMARK, screenerUniverse } from "@/lib/data/universe";
import { getHistory } from "@/lib/data/service";
import { AppNav, AppFooter } from "@/components/layout/app-nav";
import { SymbolSearch } from "@/components/layout/symbol-search";
import { VerdictBadge, ScoreBar, OriginBadge, Disclaimer } from "@/components/ui/primitives";
import { formatPrice, formatPercent } from "@/lib/utils/format";
import { roc } from "@/lib/indicators";
import type { DataOrigin, Verdict } from "@/types";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Market overview and the strongest swing and positional setups right now across NSE.",
};

/**
 * Rendered per request rather than prerendered.
 *
 * With ISR this page was baked at build time, when no Angel One credentials
 * exist, so every deploy shipped a dashboard full of generated sample data and
 * served it until the first revalidation. A market dashboard showing invented
 * prices as its opening impression is worse than one that takes a moment to
 * load.
 *
 * The cost is bounded: the service cache holds daily candles for six hours, so
 * only the first request after a restart does real fetching and the rest are
 * served from memory.
 */
export const dynamic = "force-dynamic";

/**
 * The 40 most liquid names, not a random slice. The full scan lives in the
 * screener, where the user has explicitly asked for it and expects to wait.
 */
const DASHBOARD_SLICE = screenerUniverse("liquid").slice(0, 40);

/**
 * Wall-clock budget for the scan behind this page.
 *
 * Angel One paces history requests at three per second, so forty cold symbols
 * take thirteen seconds at the absolute floor — before login, before the
 * instrument master, before any network latency at all. That is why this page
 * used to take the better part of a minute: it awaited all forty before
 * sending a single byte.
 *
 * Two changes fix it. The scan now spends a budget and ranks whatever it got,
 * and it renders inside a Suspense boundary so the shell streams immediately
 * and the table arrives when it is ready. A warm cache costs nothing, so the
 * budget only ever binds on the first request after a restart.
 */
const SCAN_BUDGET_MS = (() => {
  const raw = Number(process.env.MARKETMIND_DASHBOARD_BUDGET_MS);
  return Number.isFinite(raw) && raw >= 1_000 ? raw : 6_000;
})();

interface Ranked {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  score: number;
  verdict: Verdict;
  return1m: number | null;
  regime: string;
}

/**
 * The page shell. Renders and streams immediately; the scan arrives after.
 *
 * Everything that needs the network now lives inside the Suspense boundary
 * below, so the nav, the search box and the jump-off cards are interactive
 * while the scan is still running. That is the difference between a page that
 * takes nine seconds and a page that feels like it takes none.
 */
export default function DashboardPage() {
  return (
    <>
      <AppNav />

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <header className="mb-8 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-3 text-[var(--color-paper-dim)]">
            A swing-horizon read on the most liquid NSE names, scored on daily candles.
          </p>
        </header>

        <div className="mb-8 max-w-2xl lg:hidden">
          <SymbolSearch />
        </div>

        <Suspense fallback={<ScanSkeleton />}>
          <ScanSections />
        </Suspense>

        {/* --- Next actions ----------------------------------------------- */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link href="/screener" className="surface p-5">
            <Filter size={20} className="text-[var(--color-signal-500)]" />
            <h3 className="mt-3 text-lg">Screen the full universe</h3>
            <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">
              This dashboard reads the 40 most liquid names. The screener works across the{" "}
              {UNIVERSE_SIZE.toLocaleString("en-IN")}-name NSE universe, with filters you define.
            </p>
          </Link>
          <Link href="/backtest" className="surface p-5">
            <Activity size={20} className="text-[var(--color-signal-500)]" />
            <h3 className="mt-3 text-lg">Test a strategy before trusting it</h3>
            <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">
              Find out whether the approach you are considering has actually worked on the stock you are considering it
              for.
            </p>
          </Link>
        </div>

        <Disclaimer className="mt-10 max-w-3xl" />
      </main>

      <AppFooter />
    </>
  );
}

/** Shown while the scan runs. Shaped like the real thing to avoid a jump. */
function ScanSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <section className="surface mb-6 p-5">
        <h2 className="text-lg">Market breadth</h2>
        <p className="label mt-0.5">Scoring the most liquid NSE names — this takes a few seconds on a cold start</p>
        <div className="mt-4 h-2.5 w-full max-w-lg overflow-hidden rounded-full bg-[var(--color-ink-800)]">
          <div className="h-full w-1/3 animate-pulse bg-[var(--color-ink-600)]" />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="surface h-[152px] animate-pulse p-4" />
        ))}
      </div>
    </div>
  );
}

/** The part that needs the network. Streamed in once the scan settles. */
async function ScanSections() {
  const [outcome, benchmark] = await Promise.all([
    getHistoryBatchBudgeted(
      DASHBOARD_SLICE.map((u) => u.symbol),
      { timeframe: "daily", range: "2y", concurrency: 4, budgetMs: SCAN_BUDGET_MS },
    ),
    getHistory(BENCHMARK.symbol, "daily", "1y"),
  ]);

  const histories = outcome.histories;
  const ranked: Ranked[] = [];
  let liveCount = 0;

  for (const entry of DASHBOARD_SLICE) {
    const history = histories.get(entry.symbol);
    if (!history || history.data.length < 220) continue;
    if (history.origin === "live") liveCount += 1;

    const analysis = analyzeTechnical(entry.symbol, history.data, "swing", "daily");
    if (!analysis) continue;

    const candles = history.data;
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2] ?? last;

    ranked.push({
      symbol: entry.symbol,
      name: entry.name,
      sector: entry.sector,
      price: last.close,
      changePercent: prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100,
      score: analysis.compositeScore,
      verdict: analysis.verdict,
      return1m: roc(candles, 21),
      regime: analysis.trend.regime,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  const strongest = ranked.slice(0, 8);
  const weakest = ranked.slice(-6).reverse();

  const origin: DataOrigin = liveCount >= Math.max(1, ranked.length / 2) ? "live" : "sample";

  // Market breadth from what we just scanned.
  const bullish = ranked.filter((r) => r.score >= 20).length;
  const bearish = ranked.filter((r) => r.score <= -20).length;
  const neutral = ranked.length - bullish - bearish;

  const niftyReturn1m = benchmark.data.length > 21 ? roc(benchmark.data, 21) : null;
  const niftyReturn3m = benchmark.data.length > 63 ? roc(benchmark.data, 63) : null;

  if (ranked.length === 0) {
    return (
      <section className="surface p-6">
        <h2 className="text-lg">No names could be scored on this pass</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-paper-dim)]">
          The scan reached {outcome.fetched + outcome.fromCache} of {DASHBOARD_SLICE.length} symbols before its time
          budget ran out, and none came back with the 220 sessions a score needs. Reload to resume — each pass caches
          what it read, so the next one starts further along. Check <code>/api/health</code> if it does not improve.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-paper-dim)]">
          Scored {ranked.length} of {DASHBOARD_SLICE.length} names
          {outcome.skipped > 0 && (
            <span className="text-[var(--color-paper-faint)]">
              {" "}
              · {outcome.skipped} not reached this pass, reload to continue
            </span>
          )}
          {outcome.fromCache > 0 && (
            <span className="text-[var(--color-paper-faint)]"> · {outcome.fromCache} from cache</span>
          )}
        </p>
        <OriginBadge origin={origin} />
      </div>

        {/* --- Breadth ---------------------------------------------------- */}
        <section className="surface mb-6 p-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-lg">Market breadth</h2>
              <p className="label mt-0.5">How many of the scanned names are in a constructive setup</p>

              <div className="mt-4 flex h-2.5 w-full max-w-lg overflow-hidden rounded-full">
                <div
                  style={{ width: `${(bullish / Math.max(ranked.length, 1)) * 100}%` }}
                  className="bg-[var(--color-bull-500)]"
                />
                <div
                  style={{ width: `${(neutral / Math.max(ranked.length, 1)) * 100}%` }}
                  className="bg-[var(--color-flat-500)]"
                />
                <div
                  style={{ width: `${(bearish / Math.max(ranked.length, 1)) * 100}%` }}
                  className="bg-[var(--color-bear-500)]"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <span className="bull">{bullish} constructive</span>
                <span className="flat">{neutral} neutral</span>
                <span className="bear">{bearish} weak</span>
              </div>
            </div>

            <div className="flex gap-8">
              <div>
                <div className="label">Nifty 50 · 1M</div>
                <div className={`metric mt-1 text-xl ${(niftyReturn1m ?? 0) >= 0 ? "bull" : "bear"}`}>
                  {formatPercent(niftyReturn1m, 1)}
                </div>
              </div>
              <div>
                <div className="label">Nifty 50 · 3M</div>
                <div className={`metric mt-1 text-xl ${(niftyReturn3m ?? 0) >= 0 ? "bull" : "bear"}`}>
                  {formatPercent(niftyReturn3m, 1)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Strongest setups ------------------------------------------- */}
        <section className="mb-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl">Strongest setups right now</h2>
              <p className="mt-1 text-sm text-[var(--color-paper-dim)]">
                Ranked by the full composite technical score on a swing horizon.
              </p>
            </div>
            <Link
              href="/screener"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-signal-400)] hover:text-[var(--color-signal-500)]"
            >
              Build a custom screen <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {strongest.map((r, i) => (
              <Link
                key={r.symbol}
                href={`/stock/${encodeURIComponent(r.symbol)}`}
                className={`surface p-4 animate-fade-up stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base">{r.name}</h3>
                    <p className="metric mt-0.5 text-xs text-[var(--color-paper-faint)]">
                      {displaySymbol(r.symbol)} · {r.sector}
                    </p>
                  </div>
                  <span className={`metric shrink-0 text-lg ${r.score >= 20 ? "bull" : r.score <= -20 ? "bear" : "flat"}`}>
                    {r.score > 0 ? "+" : ""}
                    {r.score.toFixed(0)}
                  </span>
                </div>

                <div className="mt-3">
                  <ScoreBar score={r.score} height={4} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="metric text-sm">{formatPrice(r.price)}</div>
                    <div className={`metric text-xs ${r.changePercent >= 0 ? "bull" : "bear"}`}>
                      {formatPercent(r.changePercent, 1)} today
                    </div>
                  </div>
                  <VerdictBadge verdict={r.verdict} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* --- Weakest ---------------------------------------------------- */}
        {weakest.length > 0 && (
          <section className="surface mb-6 overflow-hidden">
            <div className="px-5 py-4">
              <h2 className="text-lg">Weakest in the scan</h2>
              <p className="label mt-0.5">
                Useful as an avoid list, and as a reminder that the engine is willing to be negative.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>1D</th>
                    <th>1M</th>
                    <th>Score</th>
                    <th>Regime</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {weakest.map((r) => (
                    <tr key={r.symbol}>
                      <td>
                        <Link
                          href={`/stock/${encodeURIComponent(r.symbol)}`}
                          className="!font-sans text-sm hover:text-[var(--color-signal-400)]"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td>{formatPrice(r.price)}</td>
                      <td className={r.changePercent >= 0 ? "bull" : "bear"}>{formatPercent(r.changePercent, 1)}</td>
                      <td className={(r.return1m ?? 0) >= 0 ? "bull" : "bear"}>{formatPercent(r.return1m, 1)}</td>
                      <td className="bear">{r.score.toFixed(0)}</td>
                      <td className="!font-sans !text-xs text-[var(--color-paper-faint)]">{r.regime}</td>
                      <td className="!font-sans">
                        <VerdictBadge verdict={r.verdict} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

    </>
  );
}
