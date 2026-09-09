import type {
  Candle,
  ScreenerFieldDef,
  ScreenerRow,
  ScreenerRule,
  Verdict,
} from "@/types";
import {
  adx,
  atr,
  bollingerBands,
  bollingerWidth,
  ema,
  historicalVolatility,
  latest,
  macd,
  mfi,
  roc,
  rsi,
  supertrend,
  volumeSma,
} from "@/lib/indicators";
import { analyzeTechnical } from "@/lib/analysis/technical";

/**
 * Screener engine.
 *
 * Fields are deliberately biased toward SWING and POSITIONAL relevance:
 * multi-week momentum, distance from long moving averages, 52-week range
 * position, trend strength, liquidity. There are no intraday fields.
 */

export const SCREENER_FIELDS: ScreenerFieldDef[] = [
  // --- Price & liquidity ---------------------------------------------------
  { key: "price", label: "Price", group: "Price & Liquidity", unit: "currency", description: "Latest closing price", defaultOperator: "gt", defaultValue: 100 },
  { key: "changePercent", label: "1-day change", group: "Price & Liquidity", unit: "percent", description: "Most recent session move", defaultOperator: "gt", defaultValue: 0 },
  { key: "avgVolume", label: "Avg volume (50d)", group: "Price & Liquidity", unit: "number", description: "Liquidity filter — avoid names you cannot exit", defaultOperator: "gt", defaultValue: 200000 },
  { key: "volumeRatio", label: "Volume vs 50d avg", group: "Price & Liquidity", unit: "ratio", description: "Above 1.5 signals unusual participation", defaultOperator: "gt", defaultValue: 1.2 },
  { key: "turnoverCr", label: "Daily turnover (₹ Cr)", group: "Price & Liquidity", unit: "number", description: "Price times volume — the practical liquidity measure", defaultOperator: "gt", defaultValue: 5 },

  // --- Technical -----------------------------------------------------------
  { key: "rsi14", label: "RSI (14)", group: "Technical", unit: "number", description: "Momentum. 40–60 is neutral, above 60 favours continuation", defaultOperator: "between", defaultValue: 50 },
  { key: "adx14", label: "ADX (14)", group: "Technical", unit: "number", description: "Trend strength. Above 25 means a trend genuinely exists", defaultOperator: "gt", defaultValue: 25 },
  { key: "atrPercent", label: "ATR % of price", group: "Technical", unit: "percent", description: "Volatility. 1.5–3% is the sweet spot for swing trading", defaultOperator: "between", defaultValue: 2 },
  { key: "distFrom200Ema", label: "Distance from 200 EMA", group: "Technical", unit: "percent", description: "Positive means price is above the long-term trend line", defaultOperator: "gt", defaultValue: 0 },
  { key: "distFrom50Ema", label: "Distance from 50 EMA", group: "Technical", unit: "percent", description: "Small positive values suggest a healthy pullback entry", defaultOperator: "between", defaultValue: 3 },
  { key: "distFrom52wHigh", label: "Distance from 52w high", group: "Technical", unit: "percent", description: "Near zero means the stock is making new highs", defaultOperator: "gt", defaultValue: -10 },
  { key: "position52w", label: "52-week range position", group: "Technical", unit: "percent", description: "0 is at the low, 100 at the high", defaultOperator: "gt", defaultValue: 60 },
  { key: "return1m", label: "1-month return", group: "Technical", unit: "percent", description: "Short-horizon momentum", defaultOperator: "gt", defaultValue: 0 },
  { key: "return3m", label: "3-month return", group: "Technical", unit: "percent", description: "The classic swing momentum window", defaultOperator: "gt", defaultValue: 5 },
  { key: "return6m", label: "6-month return", group: "Technical", unit: "percent", description: "Positional momentum", defaultOperator: "gt", defaultValue: 10 },
  { key: "return12m", label: "12-month return", group: "Technical", unit: "percent", description: "The academic momentum factor window", defaultOperator: "gt", defaultValue: 15 },
  { key: "macdHistogram", label: "MACD histogram", group: "Technical", unit: "number", description: "Positive and rising confirms momentum", defaultOperator: "gt", defaultValue: 0 },
  { key: "mfi14", label: "Money Flow Index", group: "Technical", unit: "number", description: "Volume-weighted momentum", defaultOperator: "gt", defaultValue: 50 },
  { key: "supertrendBullish", label: "Supertrend bullish", group: "Technical", unit: "number", description: "1 when the regime is bullish, 0 when bearish", defaultOperator: "eq", defaultValue: 1 },
  { key: "volatility", label: "Annualised volatility", group: "Technical", unit: "percent", description: "Lower means steadier trends", defaultOperator: "lt", defaultValue: 45 },
  { key: "bbWidth", label: "Bollinger width", group: "Technical", unit: "percent", description: "Band width as a % of price. Low readings mark a coiled range", defaultOperator: "lt", defaultValue: 8 },
  { key: "bbWidthPercentile", label: "Bollinger width percentile (1y)", group: "Technical", unit: "percent", description: "0 means the tightest the bands have been all year", defaultOperator: "lt", defaultValue: 20 },
  { key: "technicalScore", label: "Technical score", group: "Technical", unit: "score", description: "Composite engine score, -100 to +100", defaultOperator: "gt", defaultValue: 20 },
  { key: "aboveAllEmas", label: "Above 20/50/200 EMA", group: "Technical", unit: "number", description: "1 when price is above all three — a full bullish stack", defaultOperator: "eq", defaultValue: 1 },
];

export const FIELD_MAP = new Map(SCREENER_FIELDS.map((f) => [f.key, f]));

/**
 * Compute every screenable metric for one symbol from its candles.
 * Returns null when there is not enough history to be meaningful.
 */
export function computeMetrics(symbol: string, candles: Candle[]): Record<string, number | null> | null {
  if (candles.length < 220) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const price = last.close;

  const ema20 = latest(ema(candles, 20));
  const ema50 = latest(ema(candles, 50));
  const ema200 = latest(ema(candles, 200));
  const rsi14 = latest(rsi(candles, 14));
  const adxResult = adx(candles, 14);
  const adx14 = latest(adxResult.adx);
  const atr14 = latest(atr(candles, 14));
  const macdResult = macd(candles, 12, 26, 9);
  const macdHist = latest(macdResult.histogram);
  const mfi14 = latest(mfi(candles, 14));
  const avgVolume = latest(volumeSma(candles, 50));
  const st = supertrend(candles, 10, 3);
  const stBullish = st.length > 0 ? (st[st.length - 1].direction === 1 ? 1 : 0) : null;

  const window = candles.slice(-252);
  const high52 = Math.max(...window.map((c) => c.high));
  const low52 = Math.min(...window.map((c) => c.low));

  // Bollinger width, plus where the current reading sits in its own one-year
  // range. The percentile is what actually identifies a squeeze: 6% width is
  // tight for one stock and wide for another, so an absolute threshold alone
  // would screen for "low volatility names" rather than "names that are
  // currently quiet relative to how they normally trade".
  const widthSeries = bollingerWidth(bollingerBands(candles, 20, 2));
  const bbWidth = latest(widthSeries);
  const widthWindow = widthSeries.slice(-252).map((p) => p.value).filter(Number.isFinite);
  const bbWidthPercentile =
    bbWidth !== null && widthWindow.length >= 60
      ? (widthWindow.filter((v) => v < bbWidth).length / widthWindow.length) * 100
      : null;

  const recentVol = candles.slice(-5).reduce((a, c) => a + c.volume, 0) / 5;

  const aboveAll =
    ema20 !== null && ema50 !== null && ema200 !== null
      ? price > ema20 && ema20 > ema50 && ema50 > ema200
        ? 1
        : 0
      : null;

  return {
    price,
    changePercent: prev.close === 0 ? 0 : ((price - prev.close) / prev.close) * 100,
    avgVolume,
    volumeRatio: avgVolume && avgVolume > 0 ? recentVol / avgVolume : null,
    // Indian convention: 1 crore = 10 million.
    turnoverCr: avgVolume ? (avgVolume * price) / 10_000_000 : null,
    rsi14,
    adx14,
    atrPercent: atr14 !== null && price > 0 ? (atr14 / price) * 100 : null,
    distFrom200Ema: ema200 !== null && ema200 !== 0 ? ((price - ema200) / ema200) * 100 : null,
    distFrom50Ema: ema50 !== null && ema50 !== 0 ? ((price - ema50) / ema50) * 100 : null,
    distFrom52wHigh: high52 === 0 ? null : ((price - high52) / high52) * 100,
    position52w: high52 === low52 ? 50 : ((price - low52) / (high52 - low52)) * 100,
    return1m: roc(candles, 21),
    return3m: roc(candles, 63),
    return6m: roc(candles, 126),
    return12m: roc(candles, 252),
    macdHistogram: macdHist,
    mfi14,
    supertrendBullish: stBullish,
    volatility: historicalVolatility(candles, 20),
    bbWidth,
    bbWidthPercentile,
    aboveAllEmas: aboveAll,
    technicalScore: null, // filled in by the caller, which runs the full engine
  };
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

export function evaluateRule(rule: ScreenerRule, metrics: Record<string, number | null>): boolean {
  const value = metrics[rule.field];
  // A missing metric fails the rule rather than passing silently — better to
  // omit a row than to show one that was never actually tested.
  if (value === null || value === undefined || !Number.isFinite(value)) return false;

  switch (rule.operator) {
    case "gt":
      return value > rule.value;
    case "gte":
      return value >= rule.value;
    case "lt":
      return value < rule.value;
    case "lte":
      return value <= rule.value;
    case "eq":
      return Math.abs(value - rule.value) < 1e-9;
    case "between": {
      const lo = Math.min(rule.value, rule.value2 ?? rule.value);
      const hi = Math.max(rule.value, rule.value2 ?? rule.value);
      return value >= lo && value <= hi;
    }
    default:
      return false;
  }
}

export function matchesAll(rules: ScreenerRule[], metrics: Record<string, number | null>): boolean {
  if (rules.length === 0) return true;
  return rules.every((r) => evaluateRule(r, metrics));
}

/**
 * Build a screener row, running the full technical engine so the composite
 * score and verdict shown in results match the detail pages exactly.
 */
export function buildRow(
  symbol: string,
  name: string,
  sector: string | null,
  candles: Candle[],
): ScreenerRow | null {
  const metrics = computeMetrics(symbol, candles);
  if (!metrics) return null;

  const analysis = analyzeTechnical(symbol, candles, "swing", "daily");
  const technicalScore = analysis?.compositeScore ?? 0;
  metrics.technicalScore = technicalScore;

  return {
    symbol,
    name,
    sector,
    price: metrics.price ?? 0,
    changePercent: metrics.changePercent ?? 0,
    metrics,
    technicalScore,
    // Fundamentals are not fetched during a bulk scan — doing so for 100+
    // symbols would blow past serverless limits. Detail pages carry the full
    // fundamental analysis.
    fundamentalScore: 0,
    verdict: (analysis?.verdict ?? "hold") as Verdict,
  };
}

// ---------------------------------------------------------------------------
// Presets — ready-made screens that demonstrate the engine
// ---------------------------------------------------------------------------

export interface ScreenerPreset {
  id: string;
  name: string;
  horizon: "swing" | "positional";
  description: string;
  rationale: string;
  rules: Omit<ScreenerRule, "id">[];
}

export const PRESETS: ScreenerPreset[] = [
  {
    id: "swing-momentum",
    name: "Swing Momentum",
    horizon: "swing",
    description: "Trending stocks with room to run and enough volatility to move",
    rationale:
      "Combines a confirmed trend (ADX above 25, price over the 200 EMA) with momentum that has not yet become exhausted (RSI 55–70). The ATR floor filters out names too quiet to produce a swing-sized move within a few weeks.",
    rules: [
      { field: "adx14", operator: "gt", value: 25 },
      { field: "rsi14", operator: "between", value: 55, value2: 72 },
      { field: "distFrom200Ema", operator: "gt", value: 0 },
      { field: "atrPercent", operator: "between", value: 1.5, value2: 4 },
      { field: "turnoverCr", operator: "gt", value: 10 },
    ],
  },
  {
    id: "pullback-uptrend",
    name: "Pullback in Uptrend",
    horizon: "swing",
    description: "Established uptrends that have paused — buy weakness, not strength",
    rationale:
      "The highest-probability swing entry is a shallow pullback within an intact uptrend. This screen requires the long-term trend to be up while short-term momentum has cooled to the 40–55 RSI band, near the 50 EMA where trend buyers typically step in.",
    rules: [
      { field: "distFrom200Ema", operator: "gt", value: 5 },
      { field: "rsi14", operator: "between", value: 38, value2: 55 },
      { field: "distFrom50Ema", operator: "between", value: -6, value2: 3 },
      { field: "return6m", operator: "gt", value: 8 },
      { field: "turnoverCr", operator: "gt", value: 8 },
    ],
  },
  {
    id: "breakout-watch",
    name: "Breakout Watch",
    horizon: "swing",
    description: "Coiled near 52-week highs with volume building",
    rationale:
      "Stocks within a few percent of their 52-week high, with above-average volume and a bullish Supertrend. New highs beget new highs — this is the momentum effect in its most direct form.",
    rules: [
      { field: "distFrom52wHigh", operator: "gt", value: -6 },
      { field: "volumeRatio", operator: "gt", value: 1.1 },
      { field: "supertrendBullish", operator: "eq", value: 1 },
      { field: "adx14", operator: "gt", value: 20 },
    ],
  },
  {
    id: "positional-compounders",
    name: "Positional Compounders",
    horizon: "positional",
    description: "Long-term uptrends with steady, low-drama price action",
    rationale:
      "Built for multi-month holds: sustained 12-month momentum, price above all major moving averages, and below-average volatility so the position is actually holdable through noise.",
    rules: [
      { field: "aboveAllEmas", operator: "eq", value: 1 },
      { field: "return12m", operator: "gt", value: 15 },
      { field: "volatility", operator: "lt", value: 38 },
      { field: "position52w", operator: "gt", value: 65 },
      { field: "turnoverCr", operator: "gt", value: 15 },
    ],
  },
  {
    id: "oversold-quality",
    name: "Oversold in Long-Term Uptrend",
    horizon: "positional",
    description: "Deep pullbacks in structurally strong names",
    rationale:
      "Looks for meaningful weakness (RSI below 40) in stocks that remain above their 200 EMA with positive 12-month returns. Contrarian, and it demands patience — but it is where positional entries with genuine margin of safety appear.",
    rules: [
      { field: "rsi14", operator: "lt", value: 42 },
      { field: "distFrom200Ema", operator: "gt", value: -3 },
      { field: "return12m", operator: "gt", value: 5 },
      { field: "turnoverCr", operator: "gt", value: 10 },
    ],
  },
  {
    id: "volatility-squeeze",
    name: "Volatility Squeeze",
    horizon: "swing",
    description: "Coiled ranges in healthy trends, before the move rather than after it",
    rationale:
      "The other six screens all look for something that has already happened — a trend, a breakout, a pullback. This one looks for the setup that precedes a move. It requires Bollinger width in the bottom fifth of its own one-year range, so the stock is quiet by its OWN standards rather than simply being a low-volatility name, while the 200 EMA keeps the longer trend intact. Ranges resolve in the direction of the prevailing trend more often than against it, which is why the trend filter matters more here than the direction of short-term momentum. Expect false starts: a squeeze tells you a move is coming, not which way.",
    rules: [
      { field: "bbWidthPercentile", operator: "lt", value: 20 },
      { field: "distFrom200Ema", operator: "gt", value: 0 },
      { field: "adx14", operator: "lt", value: 22 },
      { field: "rsi14", operator: "between", value: 42, value2: 62 },
      { field: "turnoverCr", operator: "gt", value: 8 },
    ],
  },
  {
    id: "high-score",
    name: "Top Engine Scores",
    horizon: "swing",
    description: "Whatever the full analysis engine rates highest right now",
    rationale:
      "Rather than filtering on individual indicators, this simply surfaces the names where the complete weighted technical engine — all five signal groups — produces the strongest composite reading.",
    rules: [
      { field: "technicalScore", operator: "gt", value: 35 },
      { field: "turnoverCr", operator: "gt", value: 8 },
    ],
  },
];

export function presetToRules(preset: ScreenerPreset): ScreenerRule[] {
  return preset.rules.map((r, i) => ({ ...r, id: `${preset.id}-${i}` }));
}
