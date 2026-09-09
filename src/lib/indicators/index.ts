import type {
  AdxResult,
  BandPoint,
  Candle,
  MacdResult,
  PivotLevel,
  Point,
  SupertrendPoint,
} from "@/types";

/**
 * Indicator library.
 *
 * Every function is pure, allocation-light and returns an empty array rather
 * than throwing when there is insufficient data. Callers can therefore chain
 * freely without defensive checks at every step.
 *
 * Default periods throughout are tuned for SWING and POSITIONAL horizons on
 * daily/weekly candles — not intraday.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wilder's smoothing (used by RSI, ATR, ADX). */
function wilderSmooth(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < period; i += 1) acc += values[i];
  out.push(acc / period);
  for (let i = period; i < values.length; i += 1) {
    const prev = out[out.length - 1];
    out.push((prev * (period - 1) + values[i]) / period);
  }
  return out;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Last value of a point series, or null. */
export function latest(series: Point[]): number | null {
  if (series.length === 0) return null;
  const v = series[series.length - 1].value;
  return Number.isFinite(v) ? v : null;
}

/** Value n bars back from the end, or null. */
export function valueAgo(series: Point[], barsAgo: number): number | null {
  const idx = series.length - 1 - barsAgo;
  if (idx < 0 || idx >= series.length) return null;
  const v = series[idx].value;
  return Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------
// Moving averages
// ---------------------------------------------------------------------------

export function sma(data: Candle[], period: number): Point[] {
  if (period <= 0 || data.length < period) return [];
  const out: Point[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) out.push({ time: data[i].time, value: sum / period });
  }
  return out;
}

export function ema(data: Candle[], period: number): Point[] {
  if (period <= 0 || data.length < period) return [];
  const k = 2 / (period + 1);
  const out: Point[] = [];
  let seed = 0;
  for (let i = 0; i < period; i += 1) seed += data[i].close;
  let prev = seed / period;
  out.push({ time: data[period - 1].time, value: prev });
  for (let i = period; i < data.length; i += 1) {
    prev = data[i].close * k + prev * (1 - k);
    out.push({ time: data[i].time, value: prev });
  }
  return out;
}

/** EMA over a plain number series, aligned to supplied times. */
function emaFromValues(values: number[], times: number[], period: number): Point[] {
  if (period <= 0 || values.length < period) return [];
  const k = 2 / (period + 1);
  const out: Point[] = [];
  let seed = 0;
  for (let i = 0; i < period; i += 1) seed += values[i];
  let prev = seed / period;
  out.push({ time: times[period - 1], value: prev });
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out.push({ time: times[i], value: prev });
  }
  return out;
}

/** Weighted moving average — heavier recent weighting for swing entries. */
export function wma(data: Candle[], period: number): Point[] {
  if (period <= 0 || data.length < period) return [];
  const denom = (period * (period + 1)) / 2;
  const out: Point[] = [];
  for (let i = period - 1; i < data.length; i += 1) {
    let acc = 0;
    for (let j = 0; j < period; j += 1) acc += data[i - period + 1 + j].close * (j + 1);
    out.push({ time: data[i].time, value: acc / denom });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Oscillators
// ---------------------------------------------------------------------------

export function rsi(data: Candle[], period = 14): Point[] {
  if (period <= 0 || data.length <= period) return [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < data.length; i += 1) {
    const delta = data[i].close - data[i - 1].close;
    gains.push(delta > 0 ? delta : 0);
    losses.push(delta < 0 ? -delta : 0);
  }
  const avgGain = wilderSmooth(gains, period);
  const avgLoss = wilderSmooth(losses, period);
  const out: Point[] = [];
  for (let i = 0; i < avgGain.length; i += 1) {
    const g = avgGain[i];
    const l = avgLoss[i];
    // Time index: gains[] starts at data[1], and smoothing starts at index period-1.
    const timeIdx = i + period;
    if (timeIdx >= data.length) break;
    const value = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    out.push({ time: data[timeIdx].time, value });
  }
  return out;
}

export function macd(data: Candle[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(data, fast);
  const emaSlow = ema(data, slow);
  if (emaFast.length === 0 || emaSlow.length === 0) return { macd: [], signal: [], histogram: [] };

  const slowMap = new Map(emaSlow.map((p) => [p.time, p.value]));
  const macdLine: Point[] = [];
  for (const p of emaFast) {
    const s = slowMap.get(p.time);
    if (s !== undefined) macdLine.push({ time: p.time, value: p.value - s });
  }
  if (macdLine.length < signalPeriod) return { macd: macdLine, signal: [], histogram: [] };

  const signal = emaFromValues(
    macdLine.map((p) => p.value),
    macdLine.map((p) => p.time),
    signalPeriod,
  );
  const signalMap = new Map(signal.map((p) => [p.time, p.value]));
  const histogram: Point[] = [];
  for (const p of macdLine) {
    const s = signalMap.get(p.time);
    if (s !== undefined) histogram.push({ time: p.time, value: p.value - s });
  }
  return { macd: macdLine, signal, histogram };
}

export function stochastic(data: Candle[], kPeriod = 14, dPeriod = 3): { k: Point[]; d: Point[] } {
  if (data.length < kPeriod) return { k: [], d: [] };
  const k: Point[] = [];
  for (let i = kPeriod - 1; i < data.length; i += 1) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j += 1) {
      if (data[j].high > hh) hh = data[j].high;
      if (data[j].low < ll) ll = data[j].low;
    }
    const range = hh - ll;
    k.push({ time: data[i].time, value: range === 0 ? 50 : ((data[i].close - ll) / range) * 100 });
  }
  const d: Point[] = [];
  for (let i = dPeriod - 1; i < k.length; i += 1) {
    let acc = 0;
    for (let j = i - dPeriod + 1; j <= i; j += 1) acc += k[j].value;
    d.push({ time: k[i].time, value: acc / dPeriod });
  }
  return { k, d };
}

export function cci(data: Candle[], period = 20): Point[] {
  if (data.length < period) return [];
  const out: Point[] = [];
  for (let i = period - 1; i < data.length; i += 1) {
    let tpSum = 0;
    const tps: number[] = [];
    for (let j = i - period + 1; j <= i; j += 1) {
      const tp = (data[j].high + data[j].low + data[j].close) / 3;
      tps.push(tp);
      tpSum += tp;
    }
    const mean = tpSum / period;
    let devSum = 0;
    for (const tp of tps) devSum += Math.abs(tp - mean);
    const meanDev = devSum / period;
    const currentTp = tps[tps.length - 1];
    out.push({ time: data[i].time, value: meanDev === 0 ? 0 : (currentTp - mean) / (0.015 * meanDev) });
  }
  return out;
}

/** Money Flow Index — volume-weighted RSI. Useful for spotting distribution. */
export function mfi(data: Candle[], period = 14): Point[] {
  if (data.length <= period) return [];
  const positive: number[] = [];
  const negative: number[] = [];
  for (let i = 1; i < data.length; i += 1) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3;
    const prevTp = (data[i - 1].high + data[i - 1].low + data[i - 1].close) / 3;
    const flow = tp * data[i].volume;
    positive.push(tp > prevTp ? flow : 0);
    negative.push(tp < prevTp ? flow : 0);
  }
  const out: Point[] = [];
  for (let i = period - 1; i < positive.length; i += 1) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      pos += positive[j];
      neg += negative[j];
    }
    const timeIdx = i + 1;
    if (timeIdx >= data.length) break;
    out.push({ time: data[timeIdx].time, value: neg === 0 ? 100 : 100 - 100 / (1 + pos / neg) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Volatility
// ---------------------------------------------------------------------------

function trueRanges(data: Candle[]): number[] {
  const tr: number[] = [];
  for (let i = 1; i < data.length; i += 1) {
    const prevClose = data[i - 1].close;
    tr.push(
      Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - prevClose),
        Math.abs(data[i].low - prevClose),
      ),
    );
  }
  return tr;
}

export function atr(data: Candle[], period = 14): Point[] {
  if (data.length <= period) return [];
  const tr = trueRanges(data);
  const smoothed = wilderSmooth(tr, period);
  const out: Point[] = [];
  for (let i = 0; i < smoothed.length; i += 1) {
    const timeIdx = i + period;
    if (timeIdx >= data.length) break;
    out.push({ time: data[timeIdx].time, value: smoothed[i] });
  }
  return out;
}

export function bollingerBands(data: Candle[], period = 20, stdDevMultiplier = 2): BandPoint[] {
  if (data.length < period) return [];
  const out: BandPoint[] = [];
  for (let i = period - 1; i < data.length; i += 1) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) sum += data[j].close;
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j += 1) variance += (data[j].close - mean) ** 2;
    const sd = Math.sqrt(variance / period);
    out.push({
      time: data[i].time,
      upper: mean + sd * stdDevMultiplier,
      middle: mean,
      lower: mean - sd * stdDevMultiplier,
    });
  }
  return out;
}

/** Bollinger bandwidth as % of the middle band — a volatility-squeeze gauge. */
export function bollingerWidth(bands: BandPoint[]): Point[] {
  return bands
    .filter((b) => b.middle !== 0)
    .map((b) => ({ time: b.time, value: ((b.upper - b.lower) / b.middle) * 100 }));
}

// ---------------------------------------------------------------------------
// Trend strength
// ---------------------------------------------------------------------------

export function adx(data: Candle[], period = 14): AdxResult {
  const empty: AdxResult = { adx: [], plusDi: [], minusDi: [] };
  if (data.length <= period * 2) return empty;

  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  for (let i = 1; i < data.length; i += 1) {
    const upMove = data[i].high - data[i - 1].high;
    const downMove = data[i - 1].low - data[i].low;
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
    const prevClose = data[i - 1].close;
    tr.push(
      Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - prevClose),
        Math.abs(data[i].low - prevClose),
      ),
    );
  }

  const smTr = wilderSmooth(tr, period);
  const smPlus = wilderSmooth(plusDm, period);
  const smMinus = wilderSmooth(minusDm, period);
  if (smTr.length === 0) return empty;

  const plusDi: Point[] = [];
  const minusDi: Point[] = [];
  const dx: number[] = [];
  for (let i = 0; i < smTr.length; i += 1) {
    const timeIdx = i + period;
    if (timeIdx >= data.length) break;
    const t = smTr[i];
    const p = t === 0 ? 0 : (smPlus[i] / t) * 100;
    const m = t === 0 ? 0 : (smMinus[i] / t) * 100;
    plusDi.push({ time: data[timeIdx].time, value: p });
    minusDi.push({ time: data[timeIdx].time, value: m });
    const sum = p + m;
    dx.push(sum === 0 ? 0 : (Math.abs(p - m) / sum) * 100);
  }

  const smoothedDx = wilderSmooth(dx, period);
  const adxLine: Point[] = [];
  for (let i = 0; i < smoothedDx.length; i += 1) {
    const idx = i + period - 1;
    if (idx >= plusDi.length) break;
    adxLine.push({ time: plusDi[idx].time, value: smoothedDx[i] });
  }

  return { adx: adxLine, plusDi, minusDi };
}

export function supertrend(data: Candle[], period = 10, multiplier = 3): SupertrendPoint[] {
  const atrSeries = atr(data, period);
  if (atrSeries.length === 0) return [];
  const atrMap = new Map(atrSeries.map((p) => [p.time, p.value]));

  const out: SupertrendPoint[] = [];
  let prevUpper = 0;
  let prevLower = 0;
  let prevSupertrend = 0;
  let prevDirection: 1 | -1 = 1;

  for (let i = 0; i < data.length; i += 1) {
    const a = atrMap.get(data[i].time);
    if (a === undefined) continue;

    const hl2 = (data[i].high + data[i].low) / 2;
    let upper = hl2 + multiplier * a;
    let lower = hl2 - multiplier * a;

    if (out.length > 0) {
      const prevClose = data[i - 1].close;
      upper = upper < prevUpper || prevClose > prevUpper ? upper : prevUpper;
      lower = lower > prevLower || prevClose < prevLower ? lower : prevLower;
    }

    let direction: 1 | -1;
    if (out.length === 0) {
      direction = data[i].close >= hl2 ? 1 : -1;
    } else if (prevSupertrend === prevUpper) {
      direction = data[i].close > upper ? 1 : -1;
    } else {
      direction = data[i].close < lower ? -1 : 1;
    }

    const value = direction === 1 ? lower : upper;
    out.push({ time: data[i].time, value, direction });

    prevUpper = upper;
    prevLower = lower;
    prevSupertrend = value;
    prevDirection = direction;
  }
  void prevDirection;
  return out;
}

// ---------------------------------------------------------------------------
// Volume
// ---------------------------------------------------------------------------

export function obv(data: Candle[]): Point[] {
  if (data.length === 0) return [];
  const out: Point[] = [{ time: data[0].time, value: 0 }];
  let running = 0;
  for (let i = 1; i < data.length; i += 1) {
    if (data[i].close > data[i - 1].close) running += data[i].volume;
    else if (data[i].close < data[i - 1].close) running -= data[i].volume;
    out.push({ time: data[i].time, value: running });
  }
  return out;
}

export function volumeSma(data: Candle[], period = 50): Point[] {
  if (data.length < period) return [];
  const out: Point[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    sum += data[i].volume;
    if (i >= period) sum -= data[i - period].volume;
    if (i >= period - 1) out.push({ time: data[i].time, value: sum / period });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Market structure
// ---------------------------------------------------------------------------

/**
 * Detect swing pivots using a symmetric lookback/lookahead window.
 * `strength` of 5 means a pivot high must be the highest of the 11-bar window.
 */
export function findPivots(
  data: Candle[],
  strength = 5,
): { highs: { index: number; price: number; time: number }[]; lows: { index: number; price: number; time: number }[] } {
  const highs: { index: number; price: number; time: number }[] = [];
  const lows: { index: number; price: number; time: number }[] = [];
  if (data.length < strength * 2 + 1) return { highs, lows };

  for (let i = strength; i < data.length - strength; i += 1) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - strength; j <= i + strength; j += 1) {
      if (j === i) continue;
      if (data[j].high >= data[i].high) isHigh = false;
      if (data[j].low <= data[i].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push({ index: i, price: data[i].high, time: data[i].time });
    if (isLow) lows.push({ index: i, price: data[i].low, time: data[i].time });
  }
  return { highs, lows };
}

/**
 * Cluster nearby pivots into support/resistance zones and score them by
 * touch count and recency. Levels within `tolerancePercent` merge together.
 */
export function supportResistance(
  data: Candle[],
  currentPrice: number,
  tolerancePercent = 1.5,
  pivotStrength = 5,
): { supports: PivotLevel[]; resistances: PivotLevel[] } {
  const { highs, lows } = findPivots(data, pivotStrength);
  const all = [...highs, ...lows];
  if (all.length === 0) return { supports: [], resistances: [] };

  const clusters: { prices: number[]; times: number[] }[] = [];
  for (const pivot of all) {
    const match = clusters.find((c) => {
      const avg = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
      return Math.abs((pivot.price - avg) / avg) * 100 <= tolerancePercent;
    });
    if (match) {
      match.prices.push(pivot.price);
      match.times.push(pivot.time);
    } else {
      clusters.push({ prices: [pivot.price], times: [pivot.time] });
    }
  }

  const now = data[data.length - 1].time;
  const oldest = data[0].time;
  const span = Math.max(now - oldest, 1);

  const levels: PivotLevel[] = clusters.map((c) => {
    const price = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
    const lastTouch = Math.max(...c.times);
    const recency = (lastTouch - oldest) / span;
    const touchScore = Math.min(c.prices.length / 4, 1);
    const strength = Math.round((touchScore * 0.6 + recency * 0.4) * 100);
    return {
      price,
      touches: c.prices.length,
      lastTouch,
      kind: price < currentPrice ? ("support" as const) : ("resistance" as const),
      strength,
    };
  });

  const supports = levels
    .filter((l) => l.kind === "support")
    .sort((a, b) => b.price - a.price)
    .slice(0, 4);
  const resistances = levels
    .filter((l) => l.kind === "resistance")
    .sort((a, b) => a.price - b.price)
    .slice(0, 4);

  return { supports, resistances };
}

/**
 * Classify structure as higher-highs/higher-lows etc. using the last
 * few confirmed pivots. This is the backbone of swing trend reading.
 */
export function marketStructure(data: Candle[], pivotStrength = 5): {
  pattern: "HH-HL" | "LH-LL" | "HH-LL" | "LH-HL" | "insufficient";
  label: string;
} {
  const { highs, lows } = findPivots(data, pivotStrength);
  if (highs.length < 2 || lows.length < 2) return { pattern: "insufficient", label: "Not enough confirmed swings" };

  const lastHighs = highs.slice(-2);
  const lastLows = lows.slice(-2);
  const higherHigh = lastHighs[1].price > lastHighs[0].price;
  const higherLow = lastLows[1].price > lastLows[0].price;

  if (higherHigh && higherLow) return { pattern: "HH-HL", label: "Higher highs and higher lows" };
  if (!higherHigh && !higherLow) return { pattern: "LH-LL", label: "Lower highs and lower lows" };
  if (higherHigh && !higherLow) return { pattern: "HH-LL", label: "Expanding range (higher high, lower low)" };
  return { pattern: "LH-HL", label: "Contracting range (lower high, higher low)" };
}

/** Rate of change over `period` bars, in percent. */
export function roc(data: Candle[], period: number): number | null {
  if (data.length <= period) return null;
  const past = data[data.length - 1 - period].close;
  if (past === 0) return null;
  return ((data[data.length - 1].close - past) / past) * 100;
}

/** Annualised volatility from daily closes, in percent. */
export function historicalVolatility(data: Candle[], period = 20): number | null {
  if (data.length <= period) return null;
  const slice = data.slice(-period - 1);
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i += 1) {
    if (slice[i - 1].close <= 0) continue;
    returns.push(Math.log(slice[i].close / slice[i - 1].close));
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/**
 * Aggregate daily candles into weekly or monthly buckets.
 * Essential for positional analysis — weekly structure filters daily noise.
 */
export function resample(data: Candle[], to: "weekly" | "monthly"): Candle[] {
  if (data.length === 0) return [];
  const buckets = new Map<string, Candle[]>();

  for (const candle of data) {
    const d = new Date(candle.time);
    let key: string;
    if (to === "monthly") {
      key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    } else {
      // ISO week bucketing: shift to the Thursday of the week.
      const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      key = `${tmp.getUTCFullYear()}-W${week}`;
    }
    const arr = buckets.get(key);
    if (arr) arr.push(candle);
    else buckets.set(key, [candle]);
  }

  const out: Candle[] = [];
  for (const group of buckets.values()) {
    if (group.length === 0) continue;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const c of group) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume;
    }
    out.push({
      time: group[group.length - 1].time,
      open: group[0].open,
      high,
      low,
      close: group[group.length - 1].close,
      volume,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}
