import {
  adx,
  atr,
  bollingerBands,
  cci,
  ema,
  macd,
  mfi,
  obv,
  rsi,
  sma,
  stochastic,
  supertrend,
} from "./index";

/**
 * The catalogue of indicators the chart can draw.
 *
 * One definition per indicator, in one place. The chart renders whatever is in
 * the active set — it holds no opinion about which indicators exist, and there
 * is no default that cannot be turned off. An empty set is a valid, fully
 * supported state: a naked candlestick chart.
 *
 * Each entry is either an OVERLAY (drawn on the price pane) or a PANE
 * (drawn in its own strip below the price). That distinction is what lets the
 * dropdown group things the way a trader expects to see them.
 */

export type IndicatorPlacement = "overlay" | "pane";

export interface IndicatorDef {
  id: IndicatorId;
  /** Full name shown in the dropdown. */
  label: string;
  /** Compact name shown in the active-indicator chips. */
  short: string;
  placement: IndicatorPlacement;
  /** One line explaining what it is for. Shown under the label. */
  hint: string;
  /** Legend colour. Multi-line indicators define their own colours at draw time. */
  color?: string;
}

export const INDICATOR_COLORS = {
  ema20: "#f2a93b",
  ema50: "#7aa2f7",
  ema200: "#bb9af7",
  sma50: "#56c8d8",
  sma200: "#d6a3ff",
  band: "#7aa2f7",
  bull: "#3fb68b",
  bear: "#e2635a",
  neutral: "#a9b6cc",
  signal: "#f2a93b",
  secondary: "#7aa2f7",
} as const;

export const INDICATORS = [
  // --- Overlays ------------------------------------------------------------
  {
    id: "ema20",
    label: "EMA 20",
    short: "EMA 20",
    placement: "overlay",
    hint: "Short-term trend. Swing pullbacks often hold here.",
    color: INDICATOR_COLORS.ema20,
  },
  {
    id: "ema50",
    label: "EMA 50",
    short: "EMA 50",
    placement: "overlay",
    hint: "The swing trader's line. Loss of it usually ends the swing.",
    color: INDICATOR_COLORS.ema50,
  },
  {
    id: "ema200",
    label: "EMA 200",
    short: "EMA 200",
    placement: "overlay",
    hint: "The positional trend filter. Above it is a different market.",
    color: INDICATOR_COLORS.ema200,
  },
  {
    id: "sma50",
    label: "SMA 50",
    short: "SMA 50",
    placement: "overlay",
    hint: "Simple average — slower to turn than the EMA of the same length.",
    color: INDICATOR_COLORS.sma50,
  },
  {
    id: "sma200",
    label: "SMA 200",
    short: "SMA 200",
    placement: "overlay",
    hint: "The institutional long-term line most desks still quote.",
    color: INDICATOR_COLORS.sma200,
  },
  {
    id: "bollinger",
    label: "Bollinger Bands (20, 2)",
    short: "Bollinger",
    placement: "overlay",
    hint: "Volatility envelope. Squeezes precede expansion.",
    color: INDICATOR_COLORS.band,
  },
  {
    id: "supertrend",
    label: "Supertrend (10, 3)",
    short: "Supertrend",
    placement: "overlay",
    hint: "Regime flag. Colour flips mark the trend change.",
    color: INDICATOR_COLORS.bull,
  },

  // --- Separate panes ------------------------------------------------------
  {
    id: "volume",
    label: "Volume",
    short: "Volume",
    placement: "pane",
    hint: "Participation. Breakouts without it tend not to hold.",
  },
  {
    id: "rsi",
    label: "RSI (14)",
    short: "RSI",
    placement: "pane",
    hint: "Momentum, 0–100. Bands drawn at 30, 50 and 70.",
  },
  {
    id: "macd",
    label: "MACD (12, 26, 9)",
    short: "MACD",
    placement: "pane",
    hint: "Trend momentum. Histogram crossing zero is the signal.",
  },
  {
    id: "adx",
    label: "ADX (14)",
    short: "ADX",
    placement: "pane",
    hint: "Trend strength with +DI/−DI. Above 25 means a trend exists.",
  },
  {
    id: "stochastic",
    label: "Stochastic (14, 3)",
    short: "Stoch",
    placement: "pane",
    hint: "Where the close sits in its recent range.",
  },
  {
    id: "mfi",
    label: "Money Flow Index (14)",
    short: "MFI",
    placement: "pane",
    hint: "RSI weighted by volume. Divergences carry more weight.",
  },
  {
    id: "cci",
    label: "CCI (20)",
    short: "CCI",
    placement: "pane",
    hint: "Deviation from the typical price. Unbounded.",
  },
  {
    id: "atr",
    label: "ATR (14)",
    short: "ATR",
    placement: "pane",
    hint: "Average true range in rupees. Size stops from this.",
  },
  {
    id: "obv",
    label: "On-Balance Volume",
    short: "OBV",
    placement: "pane",
    hint: "Cumulative volume flow. Should confirm the price trend.",
  },
] as const satisfies readonly (Omit<IndicatorDef, "id"> & { id: string })[];

export type IndicatorId = (typeof INDICATORS)[number]["id"];

export const INDICATOR_IDS: IndicatorId[] = INDICATORS.map((i) => i.id);

const BY_ID = new Map(INDICATORS.map((i) => [i.id as IndicatorId, i]));

export function getIndicator(id: IndicatorId) {
  return BY_ID.get(id);
}

export function isIndicatorId(v: unknown): v is IndicatorId {
  return typeof v === "string" && BY_ID.has(v as IndicatorId);
}

export const OVERLAY_INDICATORS = INDICATORS.filter((i) => i.placement === "overlay");
export const PANE_INDICATORS = INDICATORS.filter((i) => i.placement === "pane");

/**
 * Named starting points. These are conveniences, not defaults — the chart
 * itself starts from whatever the caller passes, and "Naked" is a first-class
 * option rather than an absence of one.
 */
export const INDICATOR_PRESETS: { id: string; label: string; ids: IndicatorId[] }[] = [
  { id: "naked", label: "Naked chart", ids: [] },
  { id: "price-action", label: "Price + volume", ids: ["volume"] },
  { id: "swing", label: "Swing setup", ids: ["ema20", "ema50", "volume", "rsi"] },
  { id: "positional", label: "Positional setup", ids: ["ema50", "ema200", "volume", "macd"] },
  { id: "volatility", label: "Volatility", ids: ["bollinger", "atr", "volume"] },
  { id: "trend-strength", label: "Trend strength", ids: ["supertrend", "adx", "volume"] },
];

/**
 * How many bars an indicator needs before it produces anything. Used to warn
 * the user rather than silently drawing nothing, which is what the old chart
 * did when a symbol had a short history.
 */
export function minimumBars(id: IndicatorId): number {
  switch (id) {
    case "ema200":
    case "sma200":
      return 200;
    case "ema50":
    case "sma50":
      return 50;
    case "macd":
      return 35;
    case "adx":
      return 30;
    case "bollinger":
    case "cci":
      return 20;
    case "rsi":
    case "stochastic":
    case "mfi":
    case "atr":
    case "supertrend":
      return 15;
    case "ema20":
      return 20;
    default:
      return 1;
  }
}

/** Re-exported so the chart imports every calculation from one module. */
export const CALC = { ema, sma, rsi, macd, adx, atr, bollingerBands, supertrend, stochastic, mfi, cci, obv };
