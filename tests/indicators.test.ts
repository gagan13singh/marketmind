import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  sma,
  ema,
  rsi,
  atr,
  adx,
  macd,
  bollingerBands,
  stochastic,
  obv,
  supertrend,
  findPivots,
  supportResistance,
  marketStructure,
  resample,
  roc,
  historicalVolatility,
  latest,
} from "../src/lib/indicators/index.ts";
import type { Candle } from "../src/types/index.ts";

const DAY = 86_400_000;

function mk(closes: number[], opts: { highs?: number[]; lows?: number[]; volumes?: number[] } = {}): Candle[] {
  return closes.map((close, i) => ({
    time: Date.UTC(2024, 0, 1) + i * DAY,
    open: i === 0 ? close : closes[i - 1],
    high: opts.highs?.[i] ?? close + 1,
    low: opts.lows?.[i] ?? close - 1,
    close,
    volume: opts.volumes?.[i] ?? 1000,
  }));
}

/** Deterministic pseudo-random walk so tests are reproducible. */
function walk(n: number, seed = 42, start = 100): Candle[] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const out: Candle[] = [];
  let price = start;
  for (let i = 0; i < n; i += 1) {
    const drift = (rand() - 0.48) * 3;
    const open = price;
    price = Math.max(1, price + drift);
    const high = Math.max(open, price) + rand() * 1.5;
    const low = Math.min(open, price) - rand() * 1.5;
    out.push({
      time: Date.UTC(2020, 0, 1) + i * DAY,
      open,
      high,
      low: Math.max(0.5, low),
      close: price,
      volume: Math.round(100_000 + rand() * 900_000),
    });
  }
  return out;
}

describe("moving averages", () => {
  test("SMA matches hand calculation", () => {
    const out = sma(mk([1, 2, 3, 4, 5]), 3);
    assert.equal(out.length, 3);
    assert.equal(out[0].value, 2); // (1+2+3)/3
    assert.equal(out[1].value, 3); // (2+3+4)/3
    assert.equal(out[2].value, 4); // (3+4+5)/3
  });

  test("SMA of a flat series equals the constant", () => {
    const out = sma(mk([7, 7, 7, 7, 7, 7]), 5);
    for (const p of out) assert.equal(p.value, 7);
  });

  test("EMA seeds from SMA then applies the smoothing factor", () => {
    const out = ema(mk([1, 2, 3, 4, 5]), 3);
    assert.equal(out.length, 3);
    assert.equal(out[0].value, 2); // seed = SMA(1,2,3)
    // k = 2/(3+1) = 0.5 -> 4*0.5 + 2*0.5 = 3
    assert.equal(out[1].value, 3);
    // 5*0.5 + 3*0.5 = 4
    assert.equal(out[2].value, 4);
  });

  test("returns empty when data is shorter than the period", () => {
    assert.deepEqual(sma(mk([1, 2]), 5), []);
    assert.deepEqual(ema(mk([1, 2]), 5), []);
  });
});

describe("RSI", () => {
  test("is 100 for a monotonically rising series", () => {
    const out = rsi(mk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]), 14);
    assert.ok(out.length > 0);
    assert.equal(latest(out), 100);
  });

  test("is 0 for a monotonically falling series", () => {
    const desc = Array.from({ length: 16 }, (_, i) => 100 - i);
    const out = rsi(mk(desc), 14);
    assert.ok(out.length > 0);
    assert.equal(latest(out), 0);
  });

  test("stays within 0-100 on a random walk", () => {
    const out = rsi(walk(300), 14);
    assert.ok(out.length > 200);
    for (const p of out) {
      assert.ok(p.value >= 0 && p.value <= 100, `RSI out of bounds: ${p.value}`);
      assert.ok(Number.isFinite(p.value));
    }
  });

  test("aligns each value to a real candle timestamp", () => {
    const data = walk(100);
    const times = new Set(data.map((c) => c.time));
    for (const p of rsi(data, 14)) assert.ok(times.has(p.time));
  });
});

describe("ATR", () => {
  test("equals the constant range for a uniform series", () => {
    // Every bar has high-low = 2 and no gaps, so TR = 2 throughout.
    const closes = Array.from({ length: 30 }, () => 100);
    const data = closes.map((c, i) => ({
      time: Date.UTC(2024, 0, 1) + i * DAY,
      open: c,
      high: c + 1,
      low: c - 1,
      close: c,
      volume: 1000,
    }));
    const out = atr(data, 14);
    assert.ok(out.length > 0);
    assert.ok(Math.abs(latest(out)! - 2) < 1e-9);
  });

  test("is always positive on a random walk", () => {
    for (const p of atr(walk(200), 14)) assert.ok(p.value > 0);
  });
});

describe("ADX", () => {
  test("reads high on a strong sustained uptrend", () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + i * 2);
    const out = adx(mk(closes), 14);
    assert.ok(out.adx.length > 0, "ADX should produce values");
    assert.ok(latest(out.adx)! > 40, `expected strong trend reading, got ${latest(out.adx)}`);
    assert.ok(latest(out.plusDi)! > latest(out.minusDi)!, "+DI should lead in an uptrend");
  });

  test("-DI leads in a downtrend", () => {
    const closes = Array.from({ length: 120 }, (_, i) => 400 - i * 2);
    const out = adx(mk(closes), 14);
    assert.ok(latest(out.minusDi)! > latest(out.plusDi)!, "-DI should lead in a downtrend");
  });

  test("all three lines stay within 0-100", () => {
    const out = adx(walk(400), 14);
    for (const p of [...out.adx, ...out.plusDi, ...out.minusDi]) {
      assert.ok(p.value >= 0 && p.value <= 100, `ADX component out of bounds: ${p.value}`);
    }
  });

  test("returns empty rather than throwing on short input", () => {
    const out = adx(mk([1, 2, 3]), 14);
    assert.deepEqual(out.adx, []);
  });
});

describe("MACD", () => {
  test("histogram equals macd minus signal", () => {
    const out = macd(walk(300), 12, 26, 9);
    assert.ok(out.histogram.length > 0);
    const signalMap = new Map(out.signal.map((p) => [p.time, p.value]));
    const macdMap = new Map(out.macd.map((p) => [p.time, p.value]));
    for (const h of out.histogram) {
      const expected = macdMap.get(h.time)! - signalMap.get(h.time)!;
      assert.ok(Math.abs(h.value - expected) < 1e-9);
    }
  });

  test("is positive when fast momentum exceeds slow", () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + i * 1.5);
    assert.ok(latest(macd(mk(closes)).macd)! > 0);
  });
});

describe("Bollinger Bands", () => {
  test("upper >= middle >= lower always", () => {
    for (const b of bollingerBands(walk(200), 20, 2)) {
      assert.ok(b.upper >= b.middle && b.middle >= b.lower);
    }
  });

  test("collapse to the mean when volatility is zero", () => {
    const out = bollingerBands(mk(Array.from({ length: 30 }, () => 50)), 20, 2);
    const last = out[out.length - 1];
    assert.equal(last.upper, 50);
    assert.equal(last.lower, 50);
  });
});

describe("Stochastic", () => {
  test("stays within 0-100", () => {
    const { k, d } = stochastic(walk(200), 14, 3);
    for (const p of [...k, ...d]) assert.ok(p.value >= 0 && p.value <= 100);
  });

  test("reads 100 when close sits at the period high", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const data = closes.map((c, i) => ({
      time: Date.UTC(2024, 0, 1) + i * DAY,
      open: c,
      high: c,
      low: c - 10,
      close: c,
      volume: 1000,
    }));
    assert.ok(latest(stochastic(data, 14, 3).k)! > 99);
  });
});

describe("OBV", () => {
  test("accumulates volume on up days and subtracts on down days", () => {
    const data = mk([10, 11, 10, 12], { volumes: [100, 200, 300, 400] });
    const out = obv(data);
    assert.equal(out[0].value, 0);
    assert.equal(out[1].value, 200); // up
    assert.equal(out[2].value, -100); // down
    assert.equal(out[3].value, 300); // up
  });
});

describe("Supertrend", () => {
  test("turns bullish on a sustained uptrend", () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + i * 2);
    const out = supertrend(mk(closes), 10, 3);
    assert.ok(out.length > 0);
    assert.equal(out[out.length - 1].direction, 1);
  });

  test("turns bearish on a sustained downtrend", () => {
    const closes = Array.from({ length: 120 }, (_, i) => 400 - i * 2);
    const out = supertrend(mk(closes), 10, 3);
    assert.equal(out[out.length - 1].direction, -1);
  });
});

describe("market structure", () => {
  test("finds pivot highs and lows in a zigzag", () => {
    const closes: number[] = [];
    for (let i = 0; i < 100; i += 1) closes.push(100 + Math.sin(i / 6) * 20);
    const { highs, lows } = findPivots(mk(closes), 5);
    assert.ok(highs.length >= 2, "should find pivot highs");
    assert.ok(lows.length >= 2, "should find pivot lows");
  });

  test("labels an uptrend as higher highs and higher lows", () => {
    const closes: number[] = [];
    for (let i = 0; i < 120; i += 1) closes.push(100 + i * 0.8 + Math.sin(i / 5) * 8);
    assert.equal(marketStructure(mk(closes), 5).pattern, "HH-HL");
  });

  test("splits levels correctly around the current price", () => {
    const data = walk(300);
    const price = data[data.length - 1].close;
    const { supports, resistances } = supportResistance(data, price);
    for (const s of supports) assert.ok(s.price < price, "support must sit below price");
    for (const r of resistances) assert.ok(r.price > price, "resistance must sit above price");
  });
});

describe("resampling", () => {
  test("weekly buckets preserve OHLC semantics", () => {
    const daily = walk(140);
    const weekly = resample(daily, "weekly");
    assert.ok(weekly.length > 15 && weekly.length < daily.length);
    for (const w of weekly) {
      assert.ok(w.high >= w.low);
      assert.ok(w.high >= w.open && w.high >= w.close);
      assert.ok(w.low <= w.open && w.low <= w.close);
    }
  });

  test("monthly aggregation totals the same volume as the source", () => {
    const daily = walk(365);
    const monthly = resample(daily, "monthly");
    const dailyVol = daily.reduce((a, c) => a + c.volume, 0);
    const monthlyVol = monthly.reduce((a, c) => a + c.volume, 0);
    assert.equal(dailyVol, monthlyVol);
  });

  test("output stays chronologically sorted", () => {
    const weekly = resample(walk(400), "weekly");
    for (let i = 1; i < weekly.length; i += 1) assert.ok(weekly[i].time > weekly[i - 1].time);
  });
});

describe("statistics", () => {
  test("ROC computes percentage change over the lookback", () => {
    const out = roc(mk([100, 105, 110, 115, 120]), 4);
    assert.ok(Math.abs(out! - 20) < 1e-9);
  });

  test("historical volatility is non-negative", () => {
    const v = historicalVolatility(walk(200), 20);
    assert.ok(v !== null && v >= 0);
  });
});

describe("robustness", () => {
  test("every indicator tolerates empty input", () => {
    const empty: Candle[] = [];
    assert.deepEqual(sma(empty, 20), []);
    assert.deepEqual(ema(empty, 20), []);
    assert.deepEqual(rsi(empty, 14), []);
    assert.deepEqual(atr(empty, 14), []);
    assert.deepEqual(obv(empty), []);
    assert.deepEqual(bollingerBands(empty, 20), []);
    assert.deepEqual(supertrend(empty), []);
    assert.deepEqual(resample(empty, "weekly"), []);
    assert.equal(roc(empty, 5), null);
    assert.equal(historicalVolatility(empty), null);
  });

  test("no indicator emits NaN on a long random walk", () => {
    const data = walk(500);
    const series = [
      ...sma(data, 50),
      ...ema(data, 200),
      ...rsi(data, 14),
      ...atr(data, 14),
      ...adx(data, 14).adx,
      ...macd(data).histogram,
      ...stochastic(data).k,
      ...obv(data),
    ];
    for (const p of series) assert.ok(Number.isFinite(p.value), `NaN found at ${p.time}`);
  });
});
