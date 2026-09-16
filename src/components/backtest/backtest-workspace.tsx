"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Play, Loader2, RotateCcw } from "lucide-react";
import { createChart, LineSeries, AreaSeries, type UTCTimestamp } from "lightweight-charts";
import type { BacktestResult, StrategyId } from "@/types";
import { STRATEGIES, defaultParams, getStrategy } from "@/lib/backtest";
import { normalizeSymbol, displaySymbol } from "@/lib/data/symbols";
import { cn } from "@/lib/utils/cn";
import { formatPrice, formatPercent, formatNumber, formatDate } from "@/lib/utils/format";
import { OriginBadge, EmptyState, Skeleton } from "@/components/ui/primitives";
import { SymbolPicker } from "@/components/layout/symbol-picker";

export function BacktestWorkspace() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") ?? "RELIANCE.NS";

  const [symbol, setSymbol] = useState(initialSymbol);
  const [strategyId, setStrategyId] = useState<StrategyId>("ema-crossover");
  const [params, setParams] = useState<Record<string, number>>(() => defaultParams("ema-crossover"));
  const [range, setRange] = useState<"2y" | "5y" | "10y">("5y");
  const [capital, setCapital] = useState(100_000);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strategy = getStrategy(strategyId);

  function selectStrategy(id: StrategyId) {
    setStrategyId(id);
    setParams(defaultParams(id));
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: normalizeSymbol(symbol),
          strategy: strategyId,
          params,
          range,
          initialCapital: capital,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "The backtest could not be run.");
      }
      setResult((await res.json()) as BacktestResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The backtest could not be run.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
      {/* --- Controls ----------------------------------------------------- */}
      <aside className="surface space-y-5 p-5 lg:sticky lg:top-24">
        <div>
          <label htmlFor="bt-symbol" className="label mb-1.5 block">
            Stock
          </label>
          <SymbolPicker value={symbol} onChange={setSymbol} />
        </div>

        <div>
          <span className="label mb-1.5 block">Strategy</span>
          <div className="space-y-1.5">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectStrategy(s.id)}
                aria-pressed={strategyId === s.id}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  strategyId === s.id
                    ? "border-[var(--color-signal-500)] bg-[color-mix(in_oklab,var(--color-signal-500)_8%,transparent)]"
                    : "border-[var(--color-ink-700)] hover:border-[var(--color-ink-600)]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--color-paper)]">{s.name}</span>
                  <span className="text-xs text-[var(--color-paper-faint)]">{s.horizon}</span>
                </div>
                <p className="mt-1 text-xs leading-snug text-[var(--color-paper-faint)]">{s.summary}</p>
              </button>
            ))}
          </div>
        </div>

        {strategy && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Parameters</span>
              <button
                type="button"
                onClick={() => setParams(defaultParams(strategyId))}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-paper-faint)] hover:text-[var(--color-paper-dim)]"
              >
                <RotateCcw size={11} /> Reset
              </button>
            </div>
            <div className="space-y-4">
              {strategy.params.map((p) => (
                <div key={p.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor={`param-${p.key}`} className="text-xs text-[var(--color-paper-dim)]">
                      {p.label}
                    </label>
                    <span className="metric text-xs text-[var(--color-paper)]">{params[p.key] ?? p.default}</span>
                  </div>
                  <input
                    id={`param-${p.key}`}
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={params[p.key] ?? p.default}
                    onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: Number(e.target.value) }))}
                    className="mt-1.5 w-full accent-[var(--color-signal-500)]"
                  />
                  <p className="mt-1 text-xs leading-snug text-[var(--color-paper-faint)]">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bt-range" className="label mb-1.5 block">
              Period
            </label>
            <select
              id="bt-range"
              value={range}
              onChange={(e) => setRange(e.target.value as "2y" | "5y" | "10y")}
              className="field"
            >
              <option value="2y">2 years</option>
              <option value="5y">5 years</option>
              <option value="10y">10 years</option>
            </select>
          </div>
          <div>
            <label htmlFor="bt-capital" className="label mb-1.5 block">
              Capital (₹)
            </label>
            <input
              id="bt-capital"
              type="number"
              value={capital}
              min={1000}
              step={10000}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="field"
            />
          </div>
        </div>

        <button type="button" onClick={run} className="btn btn-primary w-full" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {loading ? "Running…" : "Run backtest"}
        </button>

        <p className="text-xs leading-relaxed text-[var(--color-paper-faint)]">
          Signals fill at the next bar&apos;s open, never the close that produced them. Brokerage, slippage and STT are
          charged on every trade, and stops resolve against the bar&apos;s actual low.
        </p>
      </aside>

      {/* --- Results ------------------------------------------------------ */}
      <div className="min-w-0 space-y-5">
        {strategy && (
          <div className="surface p-5">
            <h2 className="text-xl">{strategy.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-paper-dim)]">{strategy.logic}</p>
          </div>
        )}

        {error && (
          <div className="surface border-[color-mix(in_oklab,var(--color-bear-500)_40%,transparent)] p-5">
            <h3 className="text-lg bear">The backtest could not be run</h3>
            <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        )}

        {!result && !loading && !error && (
          <div className="surface">
            <EmptyState
              title="Pick a strategy and run it"
              description="Compare a trend follower against a mean-reversion system on the same stock. Which one works tells you what kind of market that stock actually lives in."
            />
          </div>
        )}

        {result && !loading && <BacktestResults result={result} />}
      </div>
    </div>
  );
}

function BacktestResults({ result }: { result: BacktestResult }) {
  const m = result.metrics;
  const beat = m.alpha > 0;

  return (
    <div className="space-y-5">
      <div className="surface-raised p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label">
              {displaySymbol(result.symbol)} · {formatDate(result.startDate)} to {formatDate(result.endDate)}
            </p>
            <h2 className="mt-1.5 text-2xl">{result.verdict}</h2>
          </div>
          <OriginBadge origin={result.origin} provider={result.provider} asOf={result.asOf} notice={result.notice} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Metric
            label="Total return"
            value={formatPercent(m.totalReturn, 1)}
            tone={m.totalReturn >= 0 ? "bull" : "bear"}
          />
          <Metric label="CAGR" value={formatPercent(m.cagr, 1)} tone={m.cagr >= 0 ? "bull" : "bear"} />
          <Metric label="Max drawdown" value={formatPercent(m.maxDrawdown, 1)} tone="bear" />
          <Metric
            label="vs buy & hold"
            value={formatPercent(m.alpha, 1)}
            tone={beat ? "bull" : "bear"}
            hint={`Buy & hold: ${formatPercent(m.buyHoldReturn, 1)}`}
          />
        </div>
      </div>

      <div className="surface p-5">
        <h3 className="text-lg">Equity curve</h3>
        <p className="label mt-0.5">Strategy against simply buying and holding the same stock</p>
        <EquityChart result={result} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="surface p-5">
          <h3 className="text-lg">Performance</h3>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3.5">
            {[
              { label: "Sharpe ratio", value: formatNumber(m.sharpeRatio, 2) },
              { label: "Sortino ratio", value: formatNumber(m.sortinoRatio, 2) },
              { label: "Profit factor", value: m.profitFactor >= 999 ? "∞" : formatNumber(m.profitFactor, 2) },
              { label: "Win rate", value: formatPercent(m.winRate, 1, false) },
              { label: "Total trades", value: String(m.totalTrades) },
              { label: "Avg holding", value: `${m.avgHoldingDays.toFixed(0)} days` },
              { label: "Avg win", value: formatPrice(m.avgWin) },
              { label: "Avg loss", value: formatPrice(m.avgLoss) },
              { label: "Best trade", value: formatPercent(m.bestTrade, 1) },
              { label: "Worst trade", value: formatPercent(m.worstTrade, 1) },
              { label: "Expectancy", value: formatPrice(m.expectancy) },
              { label: "Time in market", value: formatPercent(m.exposurePercent, 0, false) },
            ].map((item) => (
              <div key={item.label} className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-[var(--color-paper-faint)]">{item.label}</dt>
                <dd className="metric text-sm">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="surface p-5">
          <h3 className="text-lg">What the numbers say</h3>
          <ul className="mt-4 space-y-3">
            {result.insights.map((insight, i) => (
              <li key={i} className="text-sm leading-relaxed text-[var(--color-paper-dim)]">
                {insight}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {result.trades.length > 0 && (
        <div className="surface overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="text-lg">Trade log</h3>
            <p className="label mt-0.5">Every position the strategy took, in order</p>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-[var(--color-ink-850)]">
                <tr>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Entry ₹</th>
                  <th>Exit ₹</th>
                  <th>Days</th>
                  <th>P&L</th>
                  <th>R</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i}>
                    <td className="!text-left">{new Date(t.entryTime).toISOString().slice(0, 10)}</td>
                    <td className="!text-left">{new Date(t.exitTime).toISOString().slice(0, 10)}</td>
                    <td>{formatNumber(t.entryPrice, 2)}</td>
                    <td>{formatNumber(t.exitPrice, 2)}</td>
                    <td>{t.holdingDays}</td>
                    <td className={t.pnl >= 0 ? "bull" : "bear"}>{formatPercent(t.pnlPercent, 1)}</td>
                    <td className={t.rMultiple >= 0 ? "bull" : "bear"}>{formatNumber(t.rMultiple, 1)}</td>
                    <td className="!font-sans !text-xs text-[var(--color-paper-faint)]">{t.exitReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear";
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className={cn("metric mt-1 text-2xl", tone === "bull" ? "bull" : tone === "bear" ? "bear" : "")}>
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-xs text-[var(--color-paper-faint)]">{hint}</div>}
    </div>
  );
}

function EquityChart({ result }: { result: BacktestResult }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const data = useMemo(() => result.equityCurve, [result]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 280,
      layout: {
        background: { color: "transparent" },
        textColor: "#6b7a95",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(36, 51, 82, 0.3)" },
        horzLines: { color: "rgba(36, 51, 82, 0.3)" },
      },
      rightPriceScale: { borderColor: "rgba(36, 51, 82, 0.6)" },
      timeScale: { borderColor: "rgba(36, 51, 82, 0.6)" },
      crosshair: { mode: 1 },
    });

    const toTime = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;

    const buyHold = chart.addSeries(LineSeries, {
      color: "rgba(125, 138, 163, 0.7)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      title: "Buy & hold",
    });
    buyHold.setData(data.map((p) => ({ time: toTime(p.time), value: p.buyHold })));

    const equity = chart.addSeries(AreaSeries, {
      lineColor: "#f2a93b",
      topColor: "rgba(242, 169, 59, 0.22)",
      bottomColor: "rgba(242, 169, 59, 0.01)",
      lineWidth: 2,
      priceLineVisible: false,
      title: "Strategy",
    });
    equity.setData(data.map((p) => ({ time: toTime(p.time), value: p.equity })));

    chart.timeScale().fitContent();

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [data]);

  return <div ref={containerRef} className="chart-frame mt-4 w-full min-w-0" style={{ height: 280 }} />;
}
