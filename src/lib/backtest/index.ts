import type {
  BacktestMetrics,
  BacktestResult,
  Candle,
  EquityPoint,
  StrategyDef,
  StrategyId,
  Trade,
} from "@/types";
import { adx, atr, bollingerBands, ema, macd, rsi, sma, supertrend } from "@/lib/indicators";

/**
 * Backtesting engine.
 *
 * Deliberate design choices, because a backtest that lies is worse than none:
 *
 *  1. NO LOOKAHEAD. A signal computed from bar i is executed at the OPEN of
 *     bar i+1. You can never trade on a close you have not yet seen.
 *  2. COSTS ARE REAL. Brokerage, slippage and STT are charged on every trade.
 *     Frictionless backtests make bad strategies look profitable.
 *  3. STOPS RESOLVE INTRABAR against the bar's low/high, not its close.
 *  4. LONG ONLY. Swing/positional retail trading in Indian equities is
 *     predominantly long; modelling shorts would imply borrow costs we cannot
 *     estimate honestly.
 */

const COSTS = {
  /** Round-trip brokerage + exchange charges, as a fraction of turnover. */
  brokerage: 0.0003,
  /** Assumed slippage per side for a liquid mid/large cap. */
  slippage: 0.0005,
  /** Securities Transaction Tax on the sell side for delivery. */
  sttSell: 0.001,
};

export const STRATEGIES: StrategyDef[] = [
  {
    id: "ema-crossover",
    name: "EMA Crossover",
    horizon: "swing",
    summary: "Enter when the fast EMA crosses above the slow EMA; exit on the reverse cross.",
    logic:
      "The classic trend-following entry. It captures the bulk of sustained moves but whipsaws badly in ranges, which is why the ADX filter and ATR stop matter more than the crossover itself.",
    params: [
      { key: "fastPeriod", label: "Fast EMA", min: 5, max: 50, step: 1, default: 20, description: "Shorter reacts faster but produces more false signals" },
      { key: "slowPeriod", label: "Slow EMA", min: 20, max: 200, step: 5, default: 50, description: "The trend filter; 50 suits swing, 200 suits positional" },
      { key: "atrStop", label: "ATR stop multiple", min: 1, max: 6, step: 0.5, default: 2.5, description: "Stop distance in ATR units" },
      { key: "adxFilter", label: "Minimum ADX", min: 0, max: 40, step: 5, default: 20, description: "Skip entries when no trend exists. 0 disables" },
    ],
  },
  {
    id: "golden-cross",
    name: "Golden Cross (50/200)",
    horizon: "positional",
    summary: "Enter when the 50-day SMA crosses above the 200-day SMA; exit on the death cross.",
    logic:
      "The most widely watched positional signal in markets. Slow and late by construction, but it keeps you in multi-month trends and out of prolonged bear phases.",
    params: [
      { key: "fastPeriod", label: "Fast SMA", min: 20, max: 100, step: 5, default: 50, description: "Standard is 50" },
      { key: "slowPeriod", label: "Slow SMA", min: 100, max: 300, step: 10, default: 200, description: "Standard is 200" },
      { key: "atrStop", label: "ATR stop multiple", min: 0, max: 8, step: 0.5, default: 4, description: "Wide stops suit positional holds. 0 disables" },
    ],
  },
  {
    id: "supertrend",
    name: "Supertrend Follower",
    horizon: "swing",
    summary: "Enter when Supertrend flips bullish; exit when it flips bearish.",
    logic:
      "An ATR-based trailing regime filter. It adapts its stop distance to volatility automatically, which handles changing market conditions better than a fixed percentage stop.",
    params: [
      { key: "period", label: "ATR period", min: 5, max: 30, step: 1, default: 10, description: "Lookback for the volatility measure" },
      { key: "multiplier", label: "ATR multiplier", min: 1, max: 6, step: 0.5, default: 3, description: "Higher gives the trade more room and fewer signals" },
    ],
  },
  {
    id: "rsi-pullback",
    name: "RSI Pullback in Uptrend",
    horizon: "swing",
    summary: "Buy dips when RSI drops below the threshold while price holds above its 200 EMA.",
    logic:
      "Buying weakness only within an established uptrend. The 200 EMA filter is what separates this from catching falling knives — the same RSI signal without a trend filter performs materially worse.",
    params: [
      { key: "rsiPeriod", label: "RSI period", min: 5, max: 30, step: 1, default: 14, description: "Standard is 14" },
      { key: "oversold", label: "Entry RSI level", min: 20, max: 50, step: 1, default: 40, description: "Lower means deeper pullbacks and fewer trades" },
      { key: "exitRsi", label: "Exit RSI level", min: 50, max: 85, step: 1, default: 70, description: "Take profit when momentum peaks" },
      { key: "atrStop", label: "ATR stop multiple", min: 1, max: 6, step: 0.5, default: 2.5, description: "Stop distance in ATR units" },
    ],
  },
  {
    id: "breakout-52w",
    name: "52-Week High Breakout",
    horizon: "positional",
    summary: "Enter when price closes at a new N-day high; trail with an ATR stop.",
    logic:
      "Pure momentum. Counter-intuitive to most people, but new highs are followed by further new highs more often than chance — this is the effect behind momentum investing.",
    params: [
      { key: "lookback", label: "Breakout lookback (days)", min: 20, max: 300, step: 10, default: 252, description: "252 is roughly one trading year" },
      { key: "atrStop", label: "ATR trailing stop", min: 1, max: 8, step: 0.5, default: 3, description: "Trails the highest close since entry" },
      { key: "volumeFilter", label: "Min volume ratio", min: 0, max: 3, step: 0.25, default: 1.2, description: "Require above-average volume on breakout. 0 disables" },
    ],
  },
  {
    id: "macd-trend",
    name: "MACD Trend",
    horizon: "swing",
    summary: "Enter on a bullish MACD cross above the zero line; exit on the bearish cross.",
    logic:
      "Requiring the cross to occur above zero filters out counter-trend signals during downtrends, which is the main weakness of the naive MACD system.",
    params: [
      { key: "fast", label: "Fast EMA", min: 5, max: 30, step: 1, default: 12, description: "Standard is 12" },
      { key: "slow", label: "Slow EMA", min: 15, max: 60, step: 1, default: 26, description: "Standard is 26" },
      { key: "signal", label: "Signal EMA", min: 3, max: 20, step: 1, default: 9, description: "Standard is 9" },
      { key: "atrStop", label: "ATR stop multiple", min: 0, max: 6, step: 0.5, default: 3, description: "0 disables the stop" },
    ],
  },
  {
    id: "bollinger-reversion",
    name: "Bollinger Mean Reversion",
    horizon: "swing",
    summary: "Buy a close below the lower band; exit on a return to the middle band.",
    logic:
      "A counter-trend system that works in ranging markets and loses in trending ones. Included deliberately as a contrast — comparing it against the trend systems on the same stock reveals which regime that stock actually lives in.",
    params: [
      { key: "period", label: "Period", min: 10, max: 50, step: 1, default: 20, description: "Standard is 20" },
      { key: "stdDev", label: "Standard deviations", min: 1, max: 4, step: 0.25, default: 2, description: "Wider bands mean fewer, higher-conviction signals" },
      { key: "atrStop", label: "ATR stop multiple", min: 1, max: 6, step: 0.5, default: 2, description: "Essential here — mean reversion fails badly in downtrends" },
    ],
  },
];

export function getStrategy(id: StrategyId): StrategyDef | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

export function defaultParams(id: StrategyId): Record<string, number> {
  const strategy = getStrategy(id);
  if (!strategy) return {};
  const out: Record<string, number> = {};
  for (const p of strategy.params) out[p.key] = p.default;
  return out;
}

// ---------------------------------------------------------------------------
// Signal generation
// ---------------------------------------------------------------------------

interface SignalSet {
  /** entry[i] === true means "enter at the open of bar i+1". */
  entry: boolean[];
  exit: boolean[];
  /** Optional per-bar stop level, e.g. a Supertrend line. */
  trailStop?: (number | null)[];
}

function alignToIndex(data: Candle[], series: { time: number; value: number }[]): (number | null)[] {
  const map = new Map(series.map((p) => [p.time, p.value]));
  return data.map((c) => map.get(c.time) ?? null);
}

function generateSignals(id: StrategyId, data: Candle[], params: Record<string, number>): SignalSet {
  const n = data.length;
  const entry = new Array<boolean>(n).fill(false);
  const exit = new Array<boolean>(n).fill(false);

  switch (id) {
    // NOTE: the regime strategies below are STATE-based, not transition-based.
    // A trader following "be long while fast > slow" is long whenever that
    // holds — including on the first day they look at the chart. Requiring an
    // observed crossover would silently skip any trend already underway when
    // the backtest window opens, which understates the strategy and produces
    // zero trades on data that starts mid-trend.
    case "ema-crossover": {
      const fast = alignToIndex(data, ema(data, params.fastPeriod ?? 20));
      const slow = alignToIndex(data, ema(data, params.slowPeriod ?? 50));
      const adxLine = alignToIndex(data, adx(data, 14).adx);
      const minAdx = params.adxFilter ?? 20;

      for (let i = 1; i < n; i += 1) {
        const f = fast[i];
        const s = slow[i];
        if (f === null || s === null) continue;
        const adxOk = minAdx === 0 || (adxLine[i] !== null && adxLine[i]! >= minAdx);
        if (f > s && adxOk) entry[i] = true;
        if (f < s) exit[i] = true;
      }
      return { entry, exit };
    }

    case "golden-cross": {
      const fast = alignToIndex(data, sma(data, params.fastPeriod ?? 50));
      const slow = alignToIndex(data, sma(data, params.slowPeriod ?? 200));
      for (let i = 1; i < n; i += 1) {
        const f = fast[i];
        const s = slow[i];
        if (f === null || s === null) continue;
        if (f > s) entry[i] = true;
        if (f < s) exit[i] = true;
      }
      return { entry, exit };
    }

    case "supertrend": {
      const st = supertrend(data, params.period ?? 10, params.multiplier ?? 3);
      const dirMap = new Map(st.map((p) => [p.time, p.direction]));
      const valMap = new Map(st.map((p) => [p.time, p.value]));
      const trailStop = data.map((c) => valMap.get(c.time) ?? null);
      for (let i = 1; i < n; i += 1) {
        const cur = dirMap.get(data[i].time);
        if (cur === undefined) continue;
        if (cur === 1) entry[i] = true;
        if (cur === -1) exit[i] = true;
      }
      return { entry, exit, trailStop };
    }

    case "rsi-pullback": {
      const rsiLine = alignToIndex(data, rsi(data, params.rsiPeriod ?? 14));
      const trendFilter = alignToIndex(data, ema(data, 200));
      const oversold = params.oversold ?? 40;
      const exitLevel = params.exitRsi ?? 70;

      for (let i = 1; i < n; i += 1) {
        const r = rsiLine[i];
        const rp = rsiLine[i - 1];
        const trend = trendFilter[i];
        if (r === null || rp === null) continue;
        // Only buy dips inside an uptrend — this filter is the whole strategy.
        const inUptrend = trend === null || data[i].close > trend;
        if (inUptrend && rp <= oversold && r > oversold) entry[i] = true;
        if (r >= exitLevel) exit[i] = true;
        if (trend !== null && data[i].close < trend) exit[i] = true;
      }
      return { entry, exit };
    }

    case "breakout-52w": {
      const lookback = Math.round(params.lookback ?? 252);
      const volRatio = params.volumeFilter ?? 1.2;
      const volAvg = alignToIndex(data, sma(data.map((c) => ({ ...c, close: c.volume })), 50));

      for (let i = lookback; i < n; i += 1) {
        let highest = -Infinity;
        for (let j = i - lookback; j < i; j += 1) if (data[j].high > highest) highest = data[j].high;
        const volOk = volRatio === 0 || (volAvg[i] !== null && data[i].volume >= volAvg[i]! * volRatio);
        if (data[i].close > highest && volOk) entry[i] = true;
      }
      // Exit is handled entirely by the trailing stop in the executor.
      return { entry, exit };
    }

    case "macd-trend": {
      const m = macd(data, params.fast ?? 12, params.slow ?? 26, params.signal ?? 9);
      const macdLine = alignToIndex(data, m.macd);
      const signalLine = alignToIndex(data, m.signal);
      for (let i = 1; i < n; i += 1) {
        const mv = macdLine[i];
        const sv = signalLine[i];
        if (mv === null || sv === null) continue;
        // Requiring MACD > 0 avoids counter-trend entries in downtrends.
        if (mv > sv && mv > 0) entry[i] = true;
        if (mv < sv) exit[i] = true;
      }
      return { entry, exit };
    }

    case "bollinger-reversion": {
      const bands = bollingerBands(data, params.period ?? 20, params.stdDev ?? 2);
      const lower = alignToIndex(data, bands.map((b) => ({ time: b.time, value: b.lower })));
      const middle = alignToIndex(data, bands.map((b) => ({ time: b.time, value: b.middle })));
      for (let i = 1; i < n; i += 1) {
        const l = lower[i];
        const mid = middle[i];
        if (l === null || mid === null) continue;
        if (data[i].close < l) entry[i] = true;
        if (data[i].close > mid) exit[i] = true;
      }
      return { entry, exit };
    }

    default:
      return { entry, exit };
  }
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

interface OpenPosition {
  entryIndex: number;
  entryPrice: number;
  shares: number;
  stopLevel: number | null;
  initialRisk: number;
  highestClose: number;
}

export function runBacktest(
  symbol: string,
  data: Candle[],
  strategyId: StrategyId,
  params: Record<string, number>,
  initialCapital = 100_000,
): BacktestResult | null {
  const strategy = getStrategy(strategyId);
  if (!strategy || data.length < 220) return null;

  const merged = { ...defaultParams(strategyId), ...params };
  const signals = generateSignals(strategyId, data, merged);
  const atrLine = alignToIndex(data, atr(data, 14));
  const atrStopMultiple = merged.atrStop ?? 0;

  let cash = initialCapital;
  let position: OpenPosition | null = null;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  let peakEquity = initialCapital;
  let barsInMarket = 0;

  const firstValidIndex = data.findIndex((_, i) => atrLine[i] !== null);
  const startIndex = Math.max(firstValidIndex, 1);
  const buyHoldStart = data[startIndex].close;

  function closePosition(index: number, price: number, reason: Trade["exitReason"]): void {
    if (!position) return;
    const gross = position.shares * price;
    const costs = gross * (COSTS.brokerage + COSTS.slippage + COSTS.sttSell);
    const proceeds = gross - costs;
    const entryGross = position.shares * position.entryPrice;
    const entryCosts = entryGross * (COSTS.brokerage + COSTS.slippage);
    const pnl = proceeds - entryGross - entryCosts;

    cash += proceeds;
    trades.push({
      entryTime: data[position.entryIndex].time,
      entryPrice: position.entryPrice,
      exitTime: data[index].time,
      exitPrice: price,
      shares: position.shares,
      pnl,
      pnlPercent: (pnl / (entryGross + entryCosts)) * 100,
      holdingDays: Math.round((data[index].time - data[position.entryIndex].time) / 86_400_000),
      exitReason: reason,
      rMultiple: position.initialRisk > 0 ? (price - position.entryPrice) / position.initialRisk : 0,
    });
    position = null;
  }

  for (let i = startIndex; i < data.length; i += 1) {
    const bar = data[i];

    // --- 1. Stop check first: intrabar lows resolve before any signal -------
    if (position && position.stopLevel !== null && bar.low <= position.stopLevel) {
      // Assume fill at the stop, or at the open if the bar gapped through it.
      const fill = bar.open < position.stopLevel ? bar.open : position.stopLevel;
      closePosition(i, fill, "stop-loss");
    }

    // --- 2. Signal exits, executed at this bar's open from bar i-1's signal --
    if (position && signals.exit[i - 1]) {
      closePosition(i, bar.open, "signal");
    }

    // --- 3. Entries, also delayed by one bar to prevent lookahead ----------
    if (!position && signals.entry[i - 1] && cash > 0) {
      const entryPrice = bar.open;
      const atrValue = atrLine[i] ?? entryPrice * 0.02;
      const stopLevel = atrStopMultiple > 0 ? entryPrice - atrValue * atrStopMultiple : null;
      const shares = Math.floor((cash * 0.98) / entryPrice);
      if (shares > 0) {
        const gross = shares * entryPrice;
        cash -= gross + gross * (COSTS.brokerage + COSTS.slippage);
        position = {
          entryIndex: i,
          entryPrice,
          shares,
          stopLevel,
          initialRisk: stopLevel !== null ? entryPrice - stopLevel : atrValue * 2,
          highestClose: bar.close,
        };
      }
    }

    // --- 4. Trail the stop upward for open positions -----------------------
    if (position) {
      barsInMarket += 1;
      if (bar.close > position.highestClose) position.highestClose = bar.close;

      if (signals.trailStop) {
        const st = signals.trailStop[i];
        if (st !== null) position.stopLevel = position.stopLevel === null ? st : Math.max(position.stopLevel, st);
      } else if (atrStopMultiple > 0) {
        const atrValue = atrLine[i];
        if (atrValue !== null) {
          const trailed = position.highestClose - atrValue * atrStopMultiple;
          // A trailing stop only ever ratchets up.
          if (position.stopLevel === null || trailed > position.stopLevel) position.stopLevel = trailed;
        }
      }
    }

    // --- 5. Mark to market -------------------------------------------------
    const equity = cash + (position ? position.shares * bar.close : 0);
    if (equity > peakEquity) peakEquity = equity;
    equityCurve.push({
      time: bar.time,
      equity,
      drawdown: peakEquity === 0 ? 0 : ((equity - peakEquity) / peakEquity) * 100,
      buyHold: (bar.close / buyHoldStart) * initialCapital,
    });
  }

  // Close any open position at the final bar for an honest final figure.
  if (position) closePosition(data.length - 1, data[data.length - 1].close, "end-of-data");

  const finalEquity = equityCurve.length > 0 ? cash : initialCapital;
  const metrics = computeMetrics(
    trades,
    equityCurve,
    initialCapital,
    finalEquity,
    data,
    startIndex,
    barsInMarket,
  );

  const { verdict, insights } = interpretResults(strategy.name, metrics, trades);

  return {
    symbol,
    strategy: strategyId,
    strategyName: strategy.name,
    params: merged,
    startDate: new Date(data[startIndex].time).toISOString().slice(0, 10),
    endDate: new Date(data[data.length - 1].time).toISOString().slice(0, 10),
    initialCapital,
    finalEquity,
    metrics,
    trades,
    equityCurve,
    origin: "live",
    verdict,
    insights,
  };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function computeMetrics(
  trades: Trade[],
  equityCurve: EquityPoint[],
  initialCapital: number,
  finalEquity: number,
  data: Candle[],
  startIndex: number,
  barsInMarket: number,
): BacktestMetrics {
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  const years = Math.max(
    (data[data.length - 1].time - data[startIndex].time) / (365.25 * 86_400_000),
    1 / 365.25,
  );
  const cagr = finalEquity > 0 ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100 : -100;

  const maxDrawdown = equityCurve.length > 0 ? Math.min(...equityCurve.map((p) => p.drawdown)) : 0;

  // Daily returns from the equity curve for risk-adjusted measures.
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i += 1) {
    const prev = equityCurve[i - 1].equity;
    if (prev > 0) dailyReturns.push((equityCurve[i].equity - prev) / prev);
  }
  const meanReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const variance =
    dailyReturns.length > 1
      ? dailyReturns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / (dailyReturns.length - 1)
      : 0;
  const sd = Math.sqrt(variance);
  const sharpeRatio = sd === 0 ? 0 : (meanReturn / sd) * Math.sqrt(252);

  // Sortino penalises only downside deviation.
  const downside = dailyReturns.filter((r) => r < 0);
  const downsideSd =
    downside.length > 1
      ? Math.sqrt(downside.reduce((a, b) => a + b ** 2, 0) / downside.length)
      : 0;
  const sortinoRatio = downsideSd === 0 ? 0 : (meanReturn / downsideSd) * Math.sqrt(252);

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossProfit = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const buyHoldReturn =
    ((data[data.length - 1].close - data[startIndex].close) / data[startIndex].close) * 100;

  return {
    totalReturn,
    cagr,
    maxDrawdown,
    sharpeRatio,
    sortinoRatio,
    winRate,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss,
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    avgWin,
    avgLoss,
    avgHoldingDays:
      trades.length > 0 ? trades.reduce((a, t) => a + t.holdingDays, 0) / trades.length : 0,
    // Expectancy: the average rupee outcome per trade.
    expectancy: trades.length > 0 ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss : 0,
    bestTrade: trades.length > 0 ? Math.max(...trades.map((t) => t.pnlPercent)) : 0,
    worstTrade: trades.length > 0 ? Math.min(...trades.map((t) => t.pnlPercent)) : 0,
    buyHoldReturn,
    alpha: totalReturn - buyHoldReturn,
    exposurePercent:
      equityCurve.length > 0 ? (barsInMarket / equityCurve.length) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Interpretation — turning numbers into a judgement
// ---------------------------------------------------------------------------

function interpretResults(
  strategyName: string,
  m: BacktestMetrics,
  trades: Trade[],
): { verdict: string; insights: string[] } {
  const insights: string[] = [];

  if (m.totalTrades < 10) {
    insights.push(
      `Only ${m.totalTrades} trades were generated. That is too small a sample to draw statistical conclusions from — the results here are indicative at best, and could easily be luck. Test across more symbols or a longer period before trusting them.`,
    );
  }

  if (m.alpha > 0) {
    insights.push(
      `The strategy returned ${m.totalReturn.toFixed(1)}% against buy-and-hold's ${m.buyHoldReturn.toFixed(1)}%, beating it by ${m.alpha.toFixed(1)} percentage points. It also spent only ${m.exposurePercent.toFixed(0)}% of the period invested, so it produced that return with materially less market exposure.`,
    );
  } else {
    insights.push(
      `The strategy returned ${m.totalReturn.toFixed(1)}% against buy-and-hold's ${m.buyHoldReturn.toFixed(1)}%, underperforming by ${Math.abs(m.alpha).toFixed(1)} percentage points. Simply holding would have done better — though the strategy was only exposed ${m.exposurePercent.toFixed(0)}% of the time, so its risk-adjusted result may still be defensible.`,
    );
  }

  if (m.maxDrawdown < -30) {
    insights.push(
      `Maximum drawdown reached ${m.maxDrawdown.toFixed(1)}%. Very few people actually hold through a decline of that size — a drawdown this deep is the most common reason a profitable system gets abandoned at exactly the wrong moment.`,
    );
  } else if (m.maxDrawdown > -15) {
    insights.push(
      `Maximum drawdown was contained to ${m.maxDrawdown.toFixed(1)}%, which is shallow enough that most people could realistically stay with the system through a bad patch.`,
    );
  }

  if (m.profitFactor > 1.5) {
    insights.push(
      `A profit factor of ${m.profitFactor.toFixed(2)} means gross profits were ${m.profitFactor.toFixed(2)}x gross losses. Anything above 1.5 is generally considered robust, and it leaves room for costs to rise without the edge disappearing.`,
    );
  } else if (m.profitFactor < 1) {
    insights.push(
      `A profit factor of ${m.profitFactor.toFixed(2)} means losses exceeded profits. The edge is negative on this data after costs.`,
    );
  }

  if (m.winRate < 45 && m.profitFactor > 1.2) {
    insights.push(
      `The win rate is only ${m.winRate.toFixed(0)}%, yet the system is still profitable because average wins (₹${m.avgWin.toFixed(0)}) are much larger than average losses (₹${m.avgLoss.toFixed(0)}). This is the normal shape of a trend-following system, and it demands the discipline to sit through long losing streaks.`,
    );
  } else if (m.winRate > 60) {
    insights.push(
      `A win rate of ${m.winRate.toFixed(0)}% is high. Check that average wins are not much smaller than average losses — frequent small gains paired with rare large losses is a fragile profile that eventually gives everything back.`,
    );
  }

  if (m.sharpeRatio > 1) {
    insights.push(`A Sharpe ratio of ${m.sharpeRatio.toFixed(2)} indicates good risk-adjusted returns; above 1 is a genuinely respectable result for a single-instrument system.`);
  } else if (m.sharpeRatio < 0.3 && m.totalTrades >= 10) {
    insights.push(`A Sharpe ratio of ${m.sharpeRatio.toFixed(2)} is weak — the returns did not adequately compensate for the volatility endured to earn them.`);
  }

  const stopExits = trades.filter((t) => t.exitReason === "stop-loss").length;
  if (trades.length > 0 && stopExits / trades.length > 0.5) {
    insights.push(
      `${((stopExits / trades.length) * 100).toFixed(0)}% of trades ended at the stop loss. That points to a stop set too tight for this instrument's volatility — widening the ATR multiple and cutting position size usually improves the outcome.`,
    );
  }

  if (m.avgHoldingDays > 0) {
    insights.push(
      `The average holding period was ${m.avgHoldingDays.toFixed(0)} days, which fits a ${m.avgHoldingDays < 45 ? "swing" : "positional"} horizon.`,
    );
  }

  let verdict: string;
  if (m.totalTrades < 10) {
    verdict = "Inconclusive — insufficient sample";
  } else if (m.profitFactor > 1.5 && m.alpha > 0 && m.maxDrawdown > -30) {
    verdict = "Strong — beat buy-and-hold with controlled risk";
  } else if (m.profitFactor > 1.2 && m.sharpeRatio > 0.5) {
    verdict = "Workable — a real but modest edge";
  } else if (m.profitFactor > 1) {
    verdict = "Marginal — profitable but not compelling";
  } else {
    verdict = "Negative — no edge on this data";
  }

  void strategyName;
  return { verdict, insights };
}
