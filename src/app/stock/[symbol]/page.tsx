import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getHistory, getQuote, getFundamentals } from "@/lib/data/service";
import { analyzeTechnical } from "@/lib/analysis/technical";
import { analyzeFundamental } from "@/lib/analysis/fundamental";
import { normalizeSymbol, displaySymbol } from "@/lib/data/symbols";
import { AppNav, AppFooter } from "@/components/layout/app-nav";
import { StockHeader } from "@/components/layout/stock-header";
import { VerdictBadge, ScoreBar, Disclaimer, EmptyState } from "@/components/ui/primitives";
import { HORIZON_META } from "@/types";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const clean = displaySymbol(normalizeSymbol(decodeURIComponent(symbol)));
  return {
    title: `${clean} analysis`,
    description: `Swing and positional technical and fundamental analysis for ${clean}.`,
  };
}

export default async function StockOverviewPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = normalizeSymbol(decodeURIComponent(raw));

  const [quote, history, fundamentals] = await Promise.all([
    getQuote(symbol),
    getHistory(symbol, "daily", "5y"),
    getFundamentals(symbol),
  ]);

  const swing = analyzeTechnical(symbol, history.data, "swing", "daily");
  const positional = analyzeTechnical(symbol, history.data, "positional", "weekly");
  const fundamental = analyzeFundamental(fundamentals.data);

  return (
    <>
      <AppNav />
      <StockHeader
        quote={quote.data}
        origin={quote.origin}
        provider={quote.provider}
        asOf={history.asOf ?? quote.asOf}
        notice={quote.notice}
      />

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        {!swing ? (
          <EmptyState
            title="Not enough price history"
            description="This symbol does not have enough daily candles for a reliable analysis. Try a more actively traded stock."
            action={
              <Link href="/screener" className="btn btn-ghost mt-2">
                Browse the screener
              </Link>
            }
          />
        ) : (
          <div className="space-y-8">
            {/* --- The two horizons, side by side ------------------------- */}
            <section>
              <h2 className="text-2xl">Two horizons, two answers</h2>
              <p className="mt-2 max-w-2xl text-sm text-[var(--color-paper-dim)]">
                The same chart is read twice. Swing analysis runs on daily candles with momentum weighted heavily;
                positional runs on weekly candles with trend weighted heavily. When they disagree, that disagreement is
                itself information.
              </p>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {[
                  { analysis: swing, horizon: "swing" as const },
                  { analysis: positional, horizon: "positional" as const },
                ].map(({ analysis, horizon }) =>
                  analysis ? (
                    <div key={horizon} className="surface p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl">{HORIZON_META[horizon].label}</h3>
                          <p className="label mt-0.5">{HORIZON_META[horizon].window}</p>
                        </div>
                        <VerdictBadge verdict={analysis.verdict} />
                      </div>

                      <div className="mt-5 flex items-baseline gap-3">
                        <span
                          className={`metric text-4xl ${analysis.compositeScore >= 20 ? "bull" : analysis.compositeScore <= -20 ? "bear" : "flat"}`}
                        >
                          {analysis.compositeScore > 0 ? "+" : ""}
                          {analysis.compositeScore.toFixed(0)}
                        </span>
                        <span className="text-xs text-[var(--color-paper-faint)]">
                          {analysis.confidence}% agreement
                        </span>
                      </div>
                      <div className="mt-3">
                        <ScoreBar score={analysis.compositeScore} />
                      </div>

                      <p className="mt-4 text-sm leading-relaxed text-[var(--color-paper-dim)]">
                        {analysis.trend.description}
                      </p>

                      <div className="mt-5 space-y-2 border-t border-[var(--color-ink-700)] pt-4">
                        {analysis.groups.map((g) => (
                          <div key={g.key} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 text-xs text-[var(--color-paper-faint)]">{g.label}</span>
                            <div className="min-w-0 flex-1">
                              <ScoreBar score={g.score} height={4} />
                            </div>
                            <span
                              className={`metric w-10 shrink-0 text-right text-xs ${g.direction === "bullish" ? "bull" : g.direction === "bearish" ? "bear" : "flat"}`}
                            >
                              {g.score > 0 ? "+" : ""}
                              {g.score.toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            </section>

            {/* --- Fundamental summary ------------------------------------ */}
            <section className="surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl">Business quality</h2>
                  <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">
                    Six areas of the financials, scored for a positional holding.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="chip chip-flat">{fundamental.qualityTier} quality</span>
                  <VerdictBadge verdict={fundamental.verdict} />
                </div>
              </div>

              <div className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {fundamental.groups.map((g) => (
                  <div key={g.key} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-[var(--color-paper-faint)]">{g.label}</span>
                    <div className="min-w-0 flex-1">
                      <ScoreBar score={g.score} height={4} />
                    </div>
                    <span
                      className={`metric w-10 shrink-0 text-right text-xs ${g.direction === "bullish" ? "bull" : g.direction === "bearish" ? "bear" : "flat"}`}
                    >
                      {g.score > 0 ? "+" : ""}
                      {g.score.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              <p className="narrative mt-6">{fundamental.narrative.split(". ").slice(0, 3).join(". ")}.</p>

              <Link
                href={`/stock/${encodeURIComponent(symbol)}/fundamental`}
                className="mt-5 inline-flex items-center gap-1.5 text-sm text-[var(--color-signal-400)] hover:text-[var(--color-signal-500)]"
              >
                Read the full fundamental workup
                <ArrowRight size={14} />
              </Link>
            </section>

            {/* --- Jump-off links ----------------------------------------- */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href={`/stock/${encodeURIComponent(symbol)}/technical`} className="surface group p-6">
                <h3 className="text-xl">Technical analysis</h3>
                <p className="mt-2 text-sm text-[var(--color-paper-dim)]">
                  Interactive chart, all {swing.groups.reduce((a, g) => a + g.readings.length, 0)} readings with their
                  conclusions, support and resistance levels, and the mechanical trade plan.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-signal-400)]">
                  Open <ArrowRight size={14} />
                </span>
              </Link>

              <Link href={`/backtest?symbol=${encodeURIComponent(symbol)}`} className="surface group p-6">
                <h3 className="text-xl">Backtest a strategy on {displaySymbol(symbol)}</h3>
                <p className="mt-2 text-sm text-[var(--color-paper-dim)]">
                  Find out whether trend-following or mean-reversion has actually worked on this stock, with real costs
                  and no lookahead.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-signal-400)]">
                  Open <ArrowRight size={14} />
                </span>
              </Link>
            </div>

            <Disclaimer className="max-w-3xl" />
          </div>
        )}
      </main>

      <AppFooter />
    </>
  );
}
