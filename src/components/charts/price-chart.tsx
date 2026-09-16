"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { Check, ChevronDown, X } from "lucide-react";
import type { Candle, Timeframe } from "@/types";
import {
  CALC,
  INDICATOR_COLORS,
  INDICATOR_PRESETS,
  OVERLAY_INDICATORS,
  PANE_INDICATORS,
  getIndicator,
  minimumBars,
  type IndicatorId,
} from "@/lib/indicators/catalog";
import { cn } from "@/lib/utils/cn";

/**
 * Price chart.
 *
 * Indicators are a SET, not a selection. Zero indicators is a supported and
 * fully rendered state — a naked candlestick chart — and every indicator is
 * independently toggleable, so any combination is valid. Overlays draw on the
 * price pane; the rest each get their own pane below it.
 *
 * Timeframes are daily, weekly and monthly only. There is no intraday path
 * here or anywhere else in the product.
 */

const COLORS = {
  bull: "#3fb68b",
  bear: "#e2635a",
  grid: "rgba(36, 51, 82, 0.35)",
  text: "#6b7a95",
  band: "rgba(122, 162, 247, 0.55)",
};

const PANE_HEIGHT = 104;
const MIN_PRICE_PANE = 200;

export function PriceChart({
  candles,
  timeframe,
  onTimeframeChange,
  height = 420,
  initialIndicators = ["ema20", "ema50", "volume"],
}: {
  candles: Candle[];
  timeframe: Timeframe;
  onTimeframeChange?: (tf: Timeframe) => void;
  height?: number;
  initialIndicators?: IndicatorId[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<IndicatorId[]>(initialIndicators);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sorting keeps the effect key stable regardless of the order the user
  // clicked things in, so toggling A then B does not rebuild differently to
  // toggling B then A.
  const activeKey = useMemo(() => [...active].sort().join(","), [active]);

  const overlays = useMemo<IndicatorId[]>(
    () => OVERLAY_INDICATORS.filter((i) => active.includes(i.id)).map((i) => i.id as IndicatorId),
    [active],
  );
  const panes = useMemo<IndicatorId[]>(
    () => PANE_INDICATORS.filter((i) => active.includes(i.id)).map((i) => i.id as IndicatorId),
    [active],
  );

  const insufficient = useMemo(
    () => active.filter((id) => candles.length < minimumBars(id)),
    [active, candles.length],
  );

  function toggle(id: IndicatorId) {
    setActive((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  // --- Chart construction --------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const paneCount = panes.length;
    const pricePaneHeight = Math.max(MIN_PRICE_PANE, height - paneCount * PANE_HEIGHT);
    const totalHeight = pricePaneHeight + paneCount * PANE_HEIGHT;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: totalHeight,
      layout: {
        background: { color: "transparent" },
        textColor: COLORS.text,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        attributionLogo: false,
        panes: { separatorColor: "rgba(36, 51, 82, 0.8)", separatorHoverColor: "rgba(242, 169, 59, 0.35)" },
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      rightPriceScale: {
        borderColor: "rgba(36, 51, 82, 0.6)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(36, 51, 82, 0.6)",
        timeVisible: false,
        rightOffset: 6,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(242, 169, 59, 0.5)", labelBackgroundColor: "#1a2540" },
        horzLine: { color: "rgba(242, 169, 59, 0.5)", labelBackgroundColor: "#1a2540" },
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });

    const toTime = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;

    const candleSeries: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.bull,
      downColor: COLORS.bear,
      borderUpColor: COLORS.bull,
      borderDownColor: COLORS.bear,
      wickUpColor: COLORS.bull,
      wickDownColor: COLORS.bear,
      priceLineVisible: false,
    });

    candleSeries.setData(
      candles.map((c) => ({
        time: toTime(c.time),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    function addLine(
      data: { time: Time; value: number }[],
      color: string,
      opts: { width?: 1 | 2 | 3; dashed?: boolean; paneIndex?: number; scaleId?: string; title?: string } = {},
    ) {
      if (data.length === 0) return;
      const series = chart.addSeries(
        LineSeries,
        {
          color,
          lineWidth: opts.width ?? 1,
          lineStyle: opts.dashed ? 2 : 0,
          priceLineVisible: false,
          lastValueVisible: opts.paneIndex !== undefined && opts.paneIndex > 0,
          crosshairMarkerVisible: false,
          ...(opts.scaleId ? { priceScaleId: opts.scaleId } : {}),
          ...(opts.title ? { title: opts.title } : {}),
        },
        opts.paneIndex ?? 0,
      );
      series.setData(data);
    }

    // --- Overlays on the price pane ---------------------------------------
    const movingAverages: [IndicatorId, number, string, "ema" | "sma"][] = [
      ["ema20", 20, INDICATOR_COLORS.ema20, "ema"],
      ["ema50", 50, INDICATOR_COLORS.ema50, "ema"],
      ["ema200", 200, INDICATOR_COLORS.ema200, "ema"],
      ["sma50", 50, INDICATOR_COLORS.sma50, "sma"],
      ["sma200", 200, INDICATOR_COLORS.sma200, "sma"],
    ];

    for (const [id, period, color, fn] of movingAverages) {
      if (!overlays.includes(id)) continue;
      const series = fn === "ema" ? CALC.ema(candles, period) : CALC.sma(candles, period);
      addLine(
        series.map((p) => ({ time: toTime(p.time), value: p.value })),
        color,
        { dashed: fn === "sma" },
      );
    }

    if (overlays.includes("bollinger")) {
      const bands = CALC.bollingerBands(candles, 20, 2);
      for (const key of ["upper", "middle", "lower"] as const) {
        addLine(
          bands.map((b) => ({ time: toTime(b.time), value: b[key] })),
          key === "middle" ? INDICATOR_COLORS.ema20 : COLORS.band,
          { dashed: key !== "middle" },
        );
      }
    }

    if (overlays.includes("supertrend")) {
      const st = CALC.supertrend(candles, 10, 3);
      if (st.length > 0) {
        // Split into contiguous runs so the colour changes at each regime flip.
        let run: { time: Time; value: number }[] = [];
        let runDirection = st[0].direction;
        const flush = () => {
          if (run.length >= 2) {
            addLine(run, runDirection === 1 ? COLORS.bull : COLORS.bear, { width: 2 });
          }
        };
        for (const point of st) {
          if (point.direction !== runDirection) {
            flush();
            run = [];
            runDirection = point.direction;
          }
          run.push({ time: toTime(point.time), value: point.value });
        }
        flush();
      }
    }

    // --- One pane per lower-panel indicator -------------------------------
    panes.forEach((id, i) => {
      const paneIndex = i + 1;

      if (id === "volume") {
        const series = chart.addSeries(
          HistogramSeries,
          { priceFormat: { type: "volume" }, priceLineVisible: false },
          paneIndex,
        );
        series.setData(
          candles.map((c) => ({
            time: toTime(c.time),
            value: c.volume,
            color: c.close >= c.open ? "rgba(63, 182, 139, 0.5)" : "rgba(226, 99, 90, 0.5)",
          })),
        );
        return;
      }

      if (id === "rsi") {
        const series = CALC.rsi(candles, 14);
        addLine(
          series.map((p) => ({ time: toTime(p.time), value: p.value })),
          INDICATOR_COLORS.signal,
          { paneIndex, title: "RSI" },
        );
        for (const [level, dashed] of [
          [70, true],
          [50, true],
          [30, true],
        ] as const) {
          addLine(
            series.map((p) => ({ time: toTime(p.time), value: level })),
            "rgba(107, 122, 149, 0.45)",
            { paneIndex, dashed },
          );
        }
        return;
      }

      if (id === "macd") {
        const result = CALC.macd(candles, 12, 26, 9);
        const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false }, paneIndex);
        hist.setData(
          result.histogram.map((p) => ({
            time: toTime(p.time),
            value: p.value,
            color: p.value >= 0 ? "rgba(63, 182, 139, 0.6)" : "rgba(226, 99, 90, 0.6)",
          })),
        );
        addLine(
          result.macd.map((p) => ({ time: toTime(p.time), value: p.value })),
          INDICATOR_COLORS.signal,
          { paneIndex, title: "MACD" },
        );
        addLine(
          result.signal.map((p) => ({ time: toTime(p.time), value: p.value })),
          INDICATOR_COLORS.secondary,
          { paneIndex, title: "Signal" },
        );
        return;
      }

      if (id === "adx") {
        const result = CALC.adx(candles, 14);
        addLine(
          result.adx.map((p) => ({ time: toTime(p.time), value: p.value })),
          INDICATOR_COLORS.signal,
          { paneIndex, width: 2, title: "ADX" },
        );
        addLine(
          result.plusDi.map((p) => ({ time: toTime(p.time), value: p.value })),
          COLORS.bull,
          { paneIndex, title: "+DI" },
        );
        addLine(
          result.minusDi.map((p) => ({ time: toTime(p.time), value: p.value })),
          COLORS.bear,
          { paneIndex, title: "-DI" },
        );
        return;
      }

      if (id === "stochastic") {
        const result = CALC.stochastic(candles, 14, 3);
        addLine(
          result.k.map((p) => ({ time: toTime(p.time), value: p.value })),
          INDICATOR_COLORS.signal,
          { paneIndex, title: "%K" },
        );
        addLine(
          result.d.map((p) => ({ time: toTime(p.time), value: p.value })),
          INDICATOR_COLORS.secondary,
          { paneIndex, title: "%D" },
        );
        return;
      }

      const simple: Partial<Record<IndicatorId, { data: { time: number; value: number }[]; color: string; title: string }>> = {
        mfi: { data: CALC.mfi(candles, 14), color: INDICATOR_COLORS.signal, title: "MFI" },
        cci: { data: CALC.cci(candles, 20), color: INDICATOR_COLORS.secondary, title: "CCI" },
        atr: { data: CALC.atr(candles, 14), color: INDICATOR_COLORS.signal, title: "ATR" },
        obv: { data: CALC.obv(candles), color: INDICATOR_COLORS.secondary, title: "OBV" },
      };
      const entry = simple[id];
      if (entry) {
        addLine(
          entry.data.map((p) => ({ time: toTime(p.time), value: p.value })),
          entry.color,
          { paneIndex, title: entry.title },
        );
      }
    });

    // Give the price pane the space it deserves and keep the strips uniform.
    const allPanes = chart.panes();
    if (allPanes.length > 1) {
      allPanes[0].setHeight(pricePaneHeight);
      for (let i = 1; i < allPanes.length; i += 1) allPanes[i].setHeight(PANE_HEIGHT);
    }

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
    // activeKey stands in for `overlays`/`panes`, which are derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, height, activeKey]);

  const timeframes: { key: Timeframe; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
  ];

  const paneCount = panes.length;
  const chartHeight = Math.max(MIN_PRICE_PANE, height - paneCount * PANE_HEIGHT) + paneCount * PANE_HEIGHT;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        {onTimeframeChange && (
          <div className="flex items-center gap-2">
            <span className="label hidden sm:inline">Timeframe</span>
            <div className="flex gap-1 rounded-lg border border-[var(--color-ink-700)] p-0.5">
              {timeframes.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onTimeframeChange(t.key)}
                  aria-pressed={timeframe === t.key}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-colors",
                    timeframe === t.key
                      ? "bg-[var(--color-ink-700)] text-[var(--color-paper)]"
                      : "text-[var(--color-paper-faint)] hover:text-[var(--color-paper-dim)]",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- Indicator dropdown ------------------------------------------ */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            className="flex h-8 items-center gap-2 rounded-lg border border-[var(--color-ink-700)] px-3 text-xs text-[var(--color-paper-dim)] transition-colors hover:border-[var(--color-ink-600)] hover:text-[var(--color-paper)]"
          >
            <span>
              Indicators
              <span className="ml-1.5 text-[var(--color-paper-faint)]">
                {active.length === 0 ? "none" : active.length}
              </span>
            </span>
            <ChevronDown size={13} className={cn("transition-transform", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <div className="animate-scale-in absolute left-0 top-[calc(100%+6px)] z-50 w-[min(320px,calc(100vw-2rem))] origin-top-left overflow-hidden rounded-xl border border-[var(--color-ink-600)] bg-[var(--color-ink-850)] shadow-2xl">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--color-ink-700)] px-3 py-2.5">
                <span className="label">
                  {active.length === 0 ? "Naked chart" : `${active.length} active`}
                </span>
                <button
                  type="button"
                  onClick={() => setActive([])}
                  disabled={active.length === 0}
                  className="text-xs text-[var(--color-paper-faint)] transition-colors hover:text-[var(--color-paper)] disabled:opacity-40 disabled:hover:text-[var(--color-paper-faint)]"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-[340px] overflow-y-auto">
                <div className="px-3 pb-1 pt-2.5">
                  <span className="label">Quick sets</span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {INDICATOR_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActive(p.ids)}
                        className="rounded-md border border-[var(--color-ink-700)] px-2 py-1 text-xs text-[var(--color-paper-dim)] transition-colors hover:border-[var(--color-signal-500)] hover:text-[var(--color-paper)]"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <IndicatorSection
                  title="On the price chart"
                  items={OVERLAY_INDICATORS}
                  active={active}
                  onToggle={toggle}
                  barCount={candles.length}
                />
                <IndicatorSection
                  title="Separate panel"
                  items={PANE_INDICATORS}
                  active={active}
                  onToggle={toggle}
                  barCount={candles.length}
                />
              </div>
            </div>
          )}
        </div>

        {/* --- Active indicator chips --------------------------------------- */}
        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {active.map((id) => {
              const def = getIndicator(id);
              if (!def) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  title={`Remove ${def.label}`}
                  className="group flex items-center gap-1.5 rounded-md border border-[var(--color-ink-700)] px-2 py-1 text-xs text-[var(--color-paper-dim)] transition-colors hover:border-[var(--color-bear-600)] hover:text-[var(--color-paper)]"
                >
                  {"color" in def && def.color && (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ background: def.color }}
                    />
                  )}
                  {def.short}
                  <X size={11} className="text-[var(--color-paper-faint)] group-hover:text-[var(--color-bear-400)]" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {insufficient.length > 0 && (
        <p className="mb-3 text-xs text-[var(--color-paper-faint)]">
          {insufficient.map((id) => getIndicator(id)?.short).filter(Boolean).join(", ")}
          {insufficient.length === 1 ? " needs" : " need"} more history than this symbol has on the{" "}
          {timeframe} timeframe, so {insufficient.length === 1 ? "it is" : "they are"} not drawn.
        </p>
      )}

      {candles.length === 0 ? (
        <div
          className="flex items-center justify-center text-sm text-[var(--color-paper-faint)]"
          style={{ height }}
        >
          No price history available for this symbol.
        </div>
      ) : (
        <div ref={containerRef} className="chart-frame w-full min-w-0" style={{ height: chartHeight }} />
      )}
    </div>
  );
}

function IndicatorSection({
  title,
  items,
  active,
  onToggle,
  barCount,
}: {
  title: string;
  items: readonly { id: IndicatorId; label: string; hint: string; color?: string }[];
  active: IndicatorId[];
  onToggle: (id: IndicatorId) => void;
  barCount: number;
}) {
  return (
    <div className="border-t border-[var(--color-ink-700)] py-1.5">
      <div className="px-3 py-1">
        <span className="label">{title}</span>
      </div>
      {items.map((item) => {
        const on = active.includes(item.id);
        const short = barCount < minimumBars(item.id);
        return (
          <button
            key={item.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={on}
            onClick={() => onToggle(item.id)}
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--color-ink-800)]"
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                on
                  ? "border-[var(--color-signal-500)] bg-[var(--color-signal-500)] text-[var(--color-ink-950)]"
                  : "border-[var(--color-ink-600)]",
              )}
            >
              {on && <Check size={11} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                {item.color && (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: item.color }}
                  />
                )}
                <span className="text-sm text-[var(--color-paper)]">{item.label}</span>
                {short && <span className="text-xs text-[var(--color-paper-faint)]">· needs more bars</span>}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-[var(--color-paper-faint)]">
                {item.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
