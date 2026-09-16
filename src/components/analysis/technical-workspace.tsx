"use client";

import { useMemo, useState } from "react";
import type { Candle, Horizon, TechnicalAnalysis, Timeframe } from "@/types";
import { HORIZON_META } from "@/types";
import { resample } from "@/lib/indicators";
import { useLiveCandles } from "@/lib/hooks/use-live-candles";
import { cn } from "@/lib/utils/cn";
import { PriceChart } from "@/components/charts/price-chart";
import type { IndicatorId } from "@/lib/indicators/catalog";
import {
  VerdictHeader,
  SignalGroupCard,
  TradePlanCard,
  NarrativeBlock,
  LevelsCard,
} from "./analysis-blocks";

type AnalysisKey = "swing-daily" | "swing-weekly" | "positional-weekly" | "positional-monthly";

/**
 * The technical analysis workspace.
 *
 * All four horizon/timeframe combinations are computed on the server and
 * passed in, so switching between them is instant rather than a round trip.
 */
export function TechnicalWorkspace({
  symbol,
  candles,
  analyses,
}: {
  symbol: string;
  candles: Candle[];
  analyses: Record<AnalysisKey, TechnicalAnalysis | null>;
}) {
  const [horizon, setHorizon] = useState<Horizon>("swing");
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");

  // The server renders settled history; this keeps the newest bar moving while
  // the session is open. Without it the chart was a snapshot that never
  // redrew, however long the tab stayed open.
  const live = useLiveCandles(symbol, candles);

  // Positional analysis is not offered on daily candles — the whole point of
  // the horizon is that it reads slower structure.
  const key: AnalysisKey =
    horizon === "swing"
      ? timeframe === "weekly"
        ? "swing-weekly"
        : "swing-daily"
      : timeframe === "monthly"
        ? "positional-monthly"
        : "positional-weekly";

  const analysis = analyses[key] ?? analyses["swing-daily"];

  const chartCandles = useMemo(() => {
    if (timeframe === "daily") return live.candles;
    return resample(live.candles, timeframe);
  }, [live.candles, timeframe]);

  /**
   * Starting indicators, matched to the horizon being read. These are only a
   * starting point — every one of them can be switched off from the chart's
   * own dropdown, including all of them at once for a naked chart.
   */
  const startingIndicators: IndicatorId[] =
    horizon === "swing"
      ? ["ema20", "ema50", "volume", "rsi"]
      : ["ema50", "ema200", "volume", "macd"];

  if (!analysis) return null;

  return (
    <div className="space-y-6">
      {/* --- Horizon switch: the most important control on the page ------- */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex w-full gap-1 rounded-xl border border-[var(--color-ink-700)] p-1 sm:w-auto">
          {(["swing", "positional"] as const).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                setHorizon(h);
                setTimeframe(h === "swing" ? "daily" : "weekly");
              }}
              aria-pressed={horizon === h}
              className={cn(
                "flex-1 rounded-lg px-3 py-2.5 text-sm transition-colors sm:flex-none sm:px-4",
                horizon === h
                  ? "bg-[var(--color-ink-700)] text-[var(--color-paper)]"
                  : "text-[var(--color-paper-faint)] hover:text-[var(--color-paper-dim)]",
              )}
            >
              {HORIZON_META[h].label}
              <span className="ml-2 text-xs text-[var(--color-paper-faint)]">{HORIZON_META[h].window}</span>
            </button>
          ))}
        </div>
        <p className="max-w-md text-xs text-[var(--color-paper-faint)]">{HORIZON_META[horizon].description}</p>
      </div>

      <VerdictHeader
        verdict={analysis.verdict}
        score={analysis.compositeScore}
        confidence={analysis.confidence}
        horizonLabel={`${HORIZON_META[horizon].label} · ${timeframe} candles`}
        title={analysis.trend.label.charAt(0).toUpperCase() + analysis.trend.label.slice(1)}
        subtitle={analysis.trend.description}
      />

      <div className="surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-xs text-[var(--color-paper-faint)]">
            {live.error
              ? live.error
              : live.streaming
                ? `Live — the current bar refreshes every 30 seconds${live.updatedAt ? `, last at ${live.updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}`
                : "Market closed. Showing the last completed session."}
          </p>
          <button
            type="button"
            onClick={live.refresh}
            disabled={live.refreshing}
            className="text-xs text-[var(--color-signal-400)] hover:text-[var(--color-signal-500)] disabled:opacity-50"
          >
            {live.refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>

        <PriceChart
          key={horizon}
          candles={chartCandles}
          timeframe={timeframe}
          initialIndicators={startingIndicators}
          onTimeframeChange={(tf) => {
            // Positional on daily candles is not a meaningful combination.
            if (horizon === "positional" && tf === "daily") {
              setHorizon("swing");
            }
            setTimeframe(tf);
          }}
          height={440}
        />
      </div>

      <NarrativeBlock
        narrative={analysis.narrative}
        points={analysis.narrativePoints}
        keyPoints={analysis.keyPoints}
        risks={analysis.risks}
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-2xl">Every reading, and what it means</h2>
          <p className="max-w-2xl text-sm text-[var(--color-paper-dim)]">
            Each group is scored from its own readings, then blended using weights that differ by horizon. Expand any
            group to see the individual indicators and the conclusion drawn from each.
          </p>
          <div className="space-y-3 pt-2">
            {analysis.groups.map((group, i) => (
              <SignalGroupCard key={group.key} group={group} defaultOpen={i === 0} />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {analysis.plan ? (
            <TradePlanCard plan={analysis.plan} price={analysis.price} />
          ) : (
            <div className="surface p-5">
              <h3 className="text-xl">No trade plan generated</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-paper-dim)]">
                The engine only produces entry, stop and target levels when the read is neutral or better. On a
                &ldquo;{analysis.verdict === "avoid" ? "avoid" : "reduce"}&rdquo; verdict, publishing a long plan would
                contradict the analysis — so it does not.
              </p>
            </div>
          )}

          <LevelsCard structure={analysis.structure} price={analysis.price} />
        </div>
      </div>
    </div>
  );
}
