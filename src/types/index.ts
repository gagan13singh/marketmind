/**
 * Core domain types for MarketMind.
 *
 * DESIGN NOTE: This platform is deliberately scoped to SWING (1-6 weeks) and
 * POSITIONAL (3-12+ months) horizons. Intraday timeframes are intentionally
 * absent from the type system so they cannot leak into the product surface.
 */

// ---------------------------------------------------------------------------
// Timeframes — swing/positional only. No intraday, by design.
// ---------------------------------------------------------------------------

export const TIMEFRAMES = ["daily", "weekly", "monthly"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const HORIZONS = ["swing", "positional"] as const;
export type Horizon = (typeof HORIZONS)[number];

export const HORIZON_META: Record<Horizon, { label: string; window: string; description: string }> = {
  swing: {
    label: "Swing",
    window: "1–6 weeks",
    description: "Riding a defined leg of a trend. Daily structure leads, weekly confirms.",
  },
  positional: {
    label: "Positional",
    window: "3–12+ months",
    description: "Holding a primary trend through noise. Weekly/monthly structure leads.",
  },
};

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export interface Candle {
  /** Milliseconds since epoch, UTC, at session close. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  volume: number;
  averageVolume: number;
  marketCap: number | null;
  peRatio: number | null;
  sector: string | null;
  industry: string | null;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export type DataOrigin = "live" | "sample";

/** Which upstream actually served the data. Shown in the UI, not just logged. */
export type DataProvider = "angelone" | "yahoo" | "sample";

export interface Sourced<T> {
  data: T;
  origin: DataOrigin;
  /** Which provider answered. Absent on cached responses from older builds. */
  provider?: DataProvider;
  /** Present when a live fetch failed and we degraded to sample data. */
  notice?: string;
  /** The date of the most recent candle, when the payload is price history. */
  asOf?: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Indicators
// ---------------------------------------------------------------------------

export interface Point {
  time: number;
  value: number;
}

export interface BandPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdResult {
  macd: Point[];
  signal: Point[];
  histogram: Point[];
}

export interface AdxResult {
  adx: Point[];
  plusDi: Point[];
  minusDi: Point[];
}

export interface SupertrendPoint {
  time: number;
  value: number;
  direction: 1 | -1;
}

export interface PivotLevel {
  price: number;
  /** How many times price reacted at this level. */
  touches: number;
  /** Most recent touch, ms since epoch. */
  lastTouch: number;
  kind: "support" | "resistance";
  /** 0-100, blends touch count, recency and volume confirmation. */
  strength: number;
}

// ---------------------------------------------------------------------------
// Analysis engine
// ---------------------------------------------------------------------------

export type SignalDirection = "bullish" | "bearish" | "neutral";

export interface SignalReading {
  /** Stable machine key, e.g. "rsi14". */
  key: string;
  label: string;
  /** Formatted for display, e.g. "58.4" or "2.8%". */
  display: string;
  raw: number | null;
  direction: SignalDirection;
  /** -100 (max bearish) .. +100 (max bullish). */
  score: number;
  /** How much this reading counts toward the composite. */
  weight: number;
  /** Plain-language conclusion. This is the "so what". */
  conclusion: string;
}

export interface SignalGroup {
  key: string;
  label: string;
  description: string;
  /** -100..+100 weighted average of its readings. */
  score: number;
  direction: SignalDirection;
  readings: SignalReading[];
  summary: string;
}

export type Verdict =
  | "strong-buy"
  | "accumulate"
  | "hold"
  | "reduce"
  | "avoid";

export interface VerdictMeta {
  label: string;
  tone: "positive" | "mild-positive" | "neutral" | "mild-negative" | "negative";
}

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  "strong-buy": { label: "Strong Setup", tone: "positive" },
  accumulate: { label: "Accumulate", tone: "mild-positive" },
  hold: { label: "Neutral / Wait", tone: "neutral" },
  reduce: { label: "Weak / Reduce", tone: "mild-negative" },
  avoid: { label: "Avoid", tone: "negative" },
};

export interface TradePlan {
  /** Suggested entry band. */
  entryLow: number;
  entryHigh: number;
  /** ATR-derived invalidation level. */
  stopLoss: number;
  stopPercent: number;
  targets: { label: string; price: number; rMultiple: number; gainPercent: number }[];
  riskRewardRatio: number;
  /** Shares for a 1% account risk on a 100,000 account, as a concrete example. */
  positionSizeExample: { accountSize: number; riskPercent: number; shares: number; capitalRequired: number };
  atr: number;
  atrPercent: number;
  /** Expected holding window given the horizon. */
  expectedHold: string;
}

export interface TechnicalAnalysis {
  symbol: string;
  timeframe: Timeframe;
  horizon: Horizon;
  asOf: string;
  price: number;
  /** -100..+100 */
  compositeScore: number;
  verdict: Verdict;
  confidence: number;
  groups: SignalGroup[];
  trend: {
    regime: "uptrend" | "downtrend" | "range";
    label: string;
    strength: number;
    description: string;
  };
  structure: {
    fiftyTwoWeekPosition: number;
    distanceFromHigh: number;
    distanceFromLow: number;
    supports: PivotLevel[];
    resistances: PivotLevel[];
  };
  plan: TradePlan | null;
  narrative: string;
  keyPoints: string[];
  risks: string[];
  narrativeSource: "engine" | "llm";
}

// ---------------------------------------------------------------------------
// Fundamentals
// ---------------------------------------------------------------------------

export interface FinancialPeriod {
  /** e.g. "FY24" or "Q2 FY25". */
  label: string;
  endDate: string;
  revenue: number | null;
  operatingProfit: number | null;
  netProfit: number | null;
  eps: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
}

export interface BalanceSheetPeriod {
  label: string;
  endDate: string;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalEquity: number | null;
  totalDebt: number | null;
  cash: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  inventory: number | null;
  receivables: number | null;
}

export interface CashFlowPeriod {
  label: string;
  endDate: string;
  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
}

export interface ShareholdingBreakdown {
  promoter: number | null;
  fii: number | null;
  dii: number | null;
  public: number | null;
  insider: number | null;
  institutions: number | null;
  pledgedPercent: number | null;
  asOf: string | null;
}

export interface ValuationSnapshot {
  peRatio: number | null;
  forwardPe: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  evToEbitda: number | null;
  pegRatio: number | null;
  dividendYield: number | null;
  earningsYield: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
}

export interface FundamentalSnapshot {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  currency: string;
  annual: FinancialPeriod[];
  quarterly: FinancialPeriod[];
  balanceSheet: BalanceSheetPeriod[];
  cashFlow: CashFlowPeriod[];
  shareholding: ShareholdingBreakdown;
  valuation: ValuationSnapshot;
  ratios: {
    roe: number | null;
    roa: number | null;
    roce: number | null;
    debtToEquity: number | null;
    currentRatio: number | null;
    quickRatio: number | null;
    interestCoverage: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    assetTurnover: number | null;
  };
  growth: {
    revenueCagr3y: number | null;
    revenueCagr5y: number | null;
    profitCagr3y: number | null;
    profitCagr5y: number | null;
    revenueYoy: number | null;
    profitYoy: number | null;
    epsGrowthYoy: number | null;
  };
}

export interface FundamentalAnalysis {
  symbol: string;
  asOf: string;
  compositeScore: number;
  verdict: Verdict;
  confidence: number;
  groups: SignalGroup[];
  narrative: string;
  keyPoints: string[];
  risks: string[];
  /** Quality tier for positional suitability. */
  qualityTier: "high" | "moderate" | "speculative";
  narrativeSource: "engine" | "llm";
}

// ---------------------------------------------------------------------------
// Screener
// ---------------------------------------------------------------------------

export type ScreenerOperator = "gt" | "lt" | "gte" | "lte" | "between" | "eq";

export interface ScreenerRule {
  id: string;
  field: string;
  operator: ScreenerOperator;
  value: number;
  value2?: number;
}

export interface ScreenerFieldDef {
  key: string;
  label: string;
  group: "Technical" | "Fundamental" | "Valuation" | "Price & Liquidity";
  unit: "percent" | "ratio" | "currency" | "number" | "score";
  description: string;
  /** Sensible defaults so a new rule is immediately meaningful. */
  defaultOperator: ScreenerOperator;
  defaultValue: number;
}

export interface ScreenerRow {
  symbol: string;
  name: string;
  sector: string | null;
  price: number;
  changePercent: number;
  metrics: Record<string, number | null>;
  technicalScore: number;
  fundamentalScore: number;
  verdict: Verdict;
}

export interface ScreenerResponse {
  rows: ScreenerRow[];
  /** How many stocks were actually evaluated in this run. */
  totalScanned: number;
  /** How many stocks the chosen tier contains in total. */
  universeSize?: number;
  /** False when the time budget ran out before the tier was exhausted. */
  complete?: boolean;
  fromCache?: number;
  fetched?: number;
  remaining?: number;
  /** Which liquidity slice was scanned. */
  tier?: "liquid" | "broad" | "full" | "all";
  tierLabel?: string;
  matched: number;
  origin: DataOrigin;
  provider?: DataProvider;
  notice?: string;
  tookMs: number;
}

// ---------------------------------------------------------------------------
// Backtesting
// ---------------------------------------------------------------------------

export type StrategyId =
  | "ema-crossover"
  | "supertrend"
  | "rsi-pullback"
  | "breakout-52w"
  | "macd-trend"
  | "bollinger-reversion"
  | "golden-cross";

export interface StrategyParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  description: string;
}

export interface StrategyDef {
  id: StrategyId;
  name: string;
  horizon: Horizon;
  summary: string;
  logic: string;
  params: StrategyParamDef[];
}

export interface Trade {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPercent: number;
  holdingDays: number;
  exitReason: "signal" | "stop-loss" | "target" | "end-of-data";
  rMultiple: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  drawdown: number;
  buyHold: number;
}

export interface BacktestMetrics {
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  avgHoldingDays: number;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
  buyHoldReturn: number;
  alpha: number;
  exposurePercent: number;
}

export interface BacktestResult {
  symbol: string;
  strategy: StrategyId;
  strategyName: string;
  params: Record<string, number>;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalEquity: number;
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: EquityPoint[];
  origin: DataOrigin;
  provider?: DataProvider;
  asOf?: string;
  notice?: string;
  verdict: string;
  insights: string[];
}
