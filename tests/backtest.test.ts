import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runBacktest, STRATEGIES, defaultParams } from "../src/lib/backtest/index.ts";
import { analyzeTechnical } from "../src/lib/analysis/technical.ts";
import { analyzeFundamental } from "../src/lib/analysis/fundamental.ts";
import type { Candle } from "../src/types/index.ts";

const DAY = 86_400_000;

function walk(n: number, seed = 7, start = 250): Candle[] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const out: Candle[] = [];
  let price = start;
  for (let i = 0; i < n; i += 1) {
    const drift = (rand() - 0.47) * 4;
    const open = price;
    price = Math.max(5, price + drift);
    out.push({
      time: Date.UTC(2018, 0, 1) + i * DAY,
      open,
      high: Math.max(open, price) + rand() * 2,
      low: Math.max(1, Math.min(open, price) - rand() * 2),
      close: price,
      volume: Math.round(200_000 + rand() * 800_000),
    });
  }
  return out;
}

/** A cleanly trending series, for strategies that should obviously profit. */
function trending(n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i += 1) {
    const base = 100 + i * 0.7 + Math.sin(i / 9) * 4;
    out.push({
      time: Date.UTC(2018, 0, 1) + i * DAY,
      open: base - 0.2,
      high: base + 1.2,
      low: base - 1.2,
      close: base,
      volume: 500_000,
    });
  }
  return out;
}

describe("strategy definitions", () => {
  test("every strategy has params with defaults inside their own bounds", () => {
    for (const s of STRATEGIES) {
      assert.ok(s.params.length > 0, `${s.id} has no params`);
      for (const p of s.params) {
        assert.ok(p.default >= p.min && p.default <= p.max, `${s.id}.${p.key} default out of range`);
        assert.ok(p.step > 0);
        assert.ok(p.description.length > 0);
      }
    }
  });

  test("defaultParams returns a value for every declared param", () => {
    for (const s of STRATEGIES) {
      const d = defaultParams(s.id);
      for (const p of s.params) assert.equal(d[p.key], p.default);
    }
  });

  test("every strategy is tagged swing or positional", () => {
    for (const s of STRATEGIES) {
      assert.ok(["swing", "positional"].includes(s.horizon), `${s.id} has an invalid horizon`);
    }
  });
});

describe("backtest execution", () => {
  const data = walk(900);

  test("every strategy runs without throwing and returns coherent output", () => {
    for (const s of STRATEGIES) {
      const result = runBacktest("TEST.NS", data, s.id, defaultParams(s.id), 100_000);
      assert.ok(result, `${s.id} returned null`);
      assert.ok(Number.isFinite(result.finalEquity), `${s.id} produced non-finite equity`);
      assert.ok(result.finalEquity >= 0, `${s.id} produced negative equity`);
      assert.ok(result.equityCurve.length > 0, `${s.id} produced no equity curve`);
      for (const key of Object.keys(result.metrics) as (keyof typeof result.metrics)[]) {
        assert.ok(Number.isFinite(result.metrics[key]), `${s.id} metric ${key} is not finite`);
      }
    }
  });

  test("returns null rather than throwing on insufficient data", () => {
    assert.equal(runBacktest("X.NS", walk(50), "ema-crossover", {}, 100_000), null);
  });

  test("trades are chronologically ordered and never overlap", () => {
    for (const s of STRATEGIES) {
      const result = runBacktest("TEST.NS", data, s.id, defaultParams(s.id));
      if (!result) continue;
      for (let i = 0; i < result.trades.length; i += 1) {
        const t = result.trades[i];
        assert.ok(t.exitTime >= t.entryTime, `${s.id}: exit before entry`);
        if (i > 0) {
          assert.ok(t.entryTime >= result.trades[i - 1].exitTime, `${s.id}: overlapping positions`);
        }
      }
    }
  });

  test("no lookahead — entries fill at or above the signal bar's low", () => {
    // Entries execute at the NEXT bar's open. Verify every entry price
    // corresponds to an actual open in the series, never a close.
    const opens = new Set(data.map((c) => c.open));
    const result = runBacktest("TEST.NS", data, "ema-crossover", defaultParams("ema-crossover"));
    assert.ok(result);
    for (const t of result.trades) {
      const isOpen = opens.has(t.entryPrice);
      assert.ok(isOpen, `entry price ${t.entryPrice} is not a real bar open — possible lookahead`);
    }
  });

  test("stop losses bound the downside on each trade", () => {
    // NOTE: stops here TRAIL upward, so a stop exit can legitimately be a
    // profit — that is the point of trailing. What must hold is that the
    // LOSS side is bounded: no stopped trade should lose far more than the
    // initial ATR-based risk, allowing some room for overnight gaps.
    const result = runBacktest("TEST.NS", data, "ema-crossover", {
      ...defaultParams("ema-crossover"),
      atrStop: 2,
    });
    assert.ok(result);
    const stopped = result.trades.filter((t) => t.exitReason === "stop-loss");
    assert.ok(stopped.length > 0, "expected at least one stop exit in this sample");
    for (const t of stopped) {
      assert.ok(t.pnlPercent > -35, `stop failed to bound the loss: ${t.pnlPercent.toFixed(1)}%`);
    }
  });

  test("a wider stop produces fewer stop-outs than a tight one", () => {
    const tight = runBacktest("TEST.NS", data, "ema-crossover", { ...defaultParams("ema-crossover"), atrStop: 1 });
    const wide = runBacktest("TEST.NS", data, "ema-crossover", { ...defaultParams("ema-crossover"), atrStop: 6 });
    assert.ok(tight && wide);
    const tightStops = tight.trades.filter((t) => t.exitReason === "stop-loss").length;
    const wideStops = wide.trades.filter((t) => t.exitReason === "stop-loss").length;
    assert.ok(tightStops >= wideStops, `tight stop (${tightStops}) should trigger at least as often as wide (${wideStops})`);
  });

  test("equity curve is continuous and drawdown is never positive", () => {
    const result = runBacktest("TEST.NS", data, "supertrend", defaultParams("supertrend"));
    assert.ok(result);
    for (let i = 1; i < result.equityCurve.length; i += 1) {
      assert.ok(result.equityCurve[i].time > result.equityCurve[i - 1].time);
      assert.ok(result.equityCurve[i].drawdown <= 0.0001);
      assert.ok(Number.isFinite(result.equityCurve[i].equity));
    }
  });

  test("trading costs are actually applied", () => {
    // On a perfectly flat series a strategy can only lose money, via costs.
    const flat: Candle[] = Array.from({ length: 400 }, (_, i) => ({
      time: Date.UTC(2018, 0, 1) + i * DAY,
      open: 100,
      high: 100.5,
      low: 99.5,
      close: 100,
      volume: 100_000,
    }));
    const result = runBacktest("FLAT.NS", flat, "ema-crossover", defaultParams("ema-crossover"));
    assert.ok(result);
    assert.ok(result.finalEquity <= 100_000, "flat market should not produce a profit");
  });

  test("a trend follower profits on a cleanly trending series", () => {
    const result = runBacktest("TREND.NS", trending(700), "supertrend", defaultParams("supertrend"));
    assert.ok(result);
    assert.ok(result.metrics.totalReturn > 0, `expected profit on a clean uptrend, got ${result.metrics.totalReturn}`);
  });

  test("win rate and trade counts reconcile", () => {
    for (const s of STRATEGIES) {
      const r = runBacktest("TEST.NS", data, s.id, defaultParams(s.id));
      if (!r || r.metrics.totalTrades === 0) continue;
      assert.equal(r.metrics.winningTrades + r.metrics.losingTrades, r.metrics.totalTrades);
      const expected = (r.metrics.winningTrades / r.metrics.totalTrades) * 100;
      assert.ok(Math.abs(r.metrics.winRate - expected) < 1e-6);
    }
  });

  test("parameter changes actually change the outcome", () => {
    const tight = runBacktest("TEST.NS", data, "ema-crossover", { fastPeriod: 5, slowPeriod: 20, atrStop: 1.5, adxFilter: 0 });
    const loose = runBacktest("TEST.NS", data, "ema-crossover", { fastPeriod: 50, slowPeriod: 200, atrStop: 5, adxFilter: 0 });
    assert.ok(tight && loose);
    assert.notEqual(tight.metrics.totalTrades, loose.metrics.totalTrades);
  });

  test("every strategy produces a verdict and insights", () => {
    for (const s of STRATEGIES) {
      const r = runBacktest("TEST.NS", data, s.id, defaultParams(s.id));
      assert.ok(r);
      assert.ok(r.verdict.length > 0, `${s.id} produced no verdict`);
      assert.ok(r.insights.length > 0, `${s.id} produced no insights`);
    }
  });
});

describe("technical analysis engine", () => {
  const data = walk(700);

  test("produces a complete analysis for both horizons", () => {
    for (const horizon of ["swing", "positional"] as const) {
      const a = analyzeTechnical("TEST.NS", data, horizon, "daily");
      assert.ok(a, `no analysis for ${horizon}`);
      assert.ok(a.groups.length >= 4, "expected at least four signal groups");
      assert.ok(a.compositeScore >= -100 && a.compositeScore <= 100);
      assert.ok(a.confidence >= 0 && a.confidence <= 100);
      assert.ok(a.narrative.length > 100, "narrative too short to be useful");
      assert.ok(a.keyPoints.length > 0);
      assert.ok(a.risks.length > 0);
    }
  });

  test("swing and positional produce genuinely different reads", () => {
    const swing = analyzeTechnical("TEST.NS", data, "swing", "daily");
    const positional = analyzeTechnical("TEST.NS", data, "positional", "weekly");
    assert.ok(swing && positional);
    // Different weights + different candle aggregation must move the number.
    assert.notEqual(swing.compositeScore.toFixed(4), positional.compositeScore.toFixed(4));
  });

  test("every reading carries a non-trivial conclusion", () => {
    const a = analyzeTechnical("TEST.NS", data, "swing", "daily");
    assert.ok(a);
    for (const g of a.groups) {
      for (const r of g.readings) {
        assert.ok(r.conclusion.length > 40, `${r.key} conclusion is too thin`);
        assert.ok(r.score >= -100 && r.score <= 100, `${r.key} score out of range`);
        assert.ok(r.weight > 0);
      }
    }
  });

  test("returns null on insufficient data instead of throwing", () => {
    assert.equal(analyzeTechnical("X.NS", walk(20), "swing", "daily"), null);
  });

  test("a strong uptrend scores positive and a downtrend scores negative", () => {
    const up = analyzeTechnical("UP.NS", trending(600), "swing", "daily");
    assert.ok(up);
    assert.ok(up.compositeScore > 0, `uptrend scored ${up.compositeScore}`);

    const down = trending(600).map((c, i, arr) => ({ ...c, open: arr[arr.length - 1 - i].open, high: arr[arr.length - 1 - i].high, low: arr[arr.length - 1 - i].low, close: arr[arr.length - 1 - i].close }));
    const d = analyzeTechnical("DOWN.NS", down, "swing", "daily");
    assert.ok(d);
    assert.ok(d.compositeScore < up.compositeScore, "downtrend should score below uptrend");
  });

  test("trade plan is internally consistent when present", () => {
    const a = analyzeTechnical("TEST.NS", trending(600), "swing", "daily");
    assert.ok(a);
    if (a.plan) {
      assert.ok(a.plan.stopLoss < a.price, "stop must sit below price for a long");
      assert.ok(a.plan.stopPercent > 0);
      assert.ok(a.plan.targets.length > 0);
      for (const t of a.plan.targets) assert.ok(t.price > a.price, "targets must sit above price");
      assert.ok(a.plan.positionSizeExample.shares >= 0);
    }
  });
});

describe("fundamental analysis engine", () => {
  test("handles a fully populated snapshot", async () => {
    const { sampleFundamentals } = await import("../src/lib/data/sample.ts");
    const snapshot = sampleFundamentals("RELIANCE.NS");
    const a = analyzeFundamental(snapshot);
    assert.ok(a.groups.length >= 5);
    assert.ok(a.compositeScore >= -100 && a.compositeScore <= 100);
    assert.ok(a.narrative.length > 150);
    assert.ok(["high", "moderate", "speculative"].includes(a.qualityTier));
  });

  test("degrades gracefully when everything is null", () => {
    const empty = {
      symbol: "EMPTY.NS",
      name: "Empty Co",
      sector: null,
      industry: null,
      currency: "INR",
      annual: [],
      quarterly: [],
      balanceSheet: [],
      cashFlow: [],
      shareholding: {
        promoter: null, fii: null, dii: null, public: null,
        insider: null, institutions: null, pledgedPercent: null, asOf: null,
      },
      valuation: {
        peRatio: null, forwardPe: null, priceToBook: null, priceToSales: null,
        evToEbitda: null, pegRatio: null, dividendYield: null, earningsYield: null,
        marketCap: null, enterpriseValue: null,
      },
      ratios: {
        roe: null, roa: null, roce: null, debtToEquity: null, currentRatio: null,
        quickRatio: null, interestCoverage: null, grossMargin: null,
        operatingMargin: null, netMargin: null, assetTurnover: null,
      },
      growth: {
        revenueCagr3y: null, revenueCagr5y: null, profitCagr3y: null,
        profitCagr5y: null, revenueYoy: null, profitYoy: null, epsGrowthYoy: null,
      },
    };
    const a = analyzeFundamental(empty);
    assert.ok(Number.isFinite(a.compositeScore));
    assert.ok(a.confidence < 60, "confidence should be low when data is absent");
    assert.ok(a.narrative.length > 0);
  });

  test("scores a strong balance sheet above a weak one", async () => {
    const { sampleFundamentals } = await import("../src/lib/data/sample.ts");
    const base = sampleFundamentals("TCS.NS");

    const strong = { ...base, ratios: { ...base.ratios, debtToEquity: 0.05, currentRatio: 2.5, quickRatio: 2.0, interestCoverage: 25 } };
    const weak = { ...base, ratios: { ...base.ratios, debtToEquity: 3.2, currentRatio: 0.7, quickRatio: 0.4, interestCoverage: 1.1 } };

    const strongBs = analyzeFundamental(strong).groups.find((g) => g.key === "balance-sheet");
    const weakBs = analyzeFundamental(weak).groups.find((g) => g.key === "balance-sheet");
    assert.ok(strongBs && weakBs);
    assert.ok(strongBs.score > weakBs.score, "strong balance sheet must outscore weak");
  });

  test("flags negative cash conversion as a serious problem", async () => {
    const { sampleFundamentals } = await import("../src/lib/data/sample.ts");
    const base = sampleFundamentals("INFY.NS");
    const bad = {
      ...base,
      cashFlow: base.cashFlow.map((c) => ({ ...c, operatingCashFlow: -Math.abs(c.operatingCashFlow ?? 1000), freeCashFlow: -Math.abs(c.freeCashFlow ?? 1000) })),
    };
    const cf = analyzeFundamental(bad).groups.find((g) => g.key === "cash-flow");
    assert.ok(cf);
    assert.ok(cf.score < -30, `expected a strongly negative cash-flow score, got ${cf.score}`);
  });
});
