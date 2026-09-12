import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Candle, Horizon } from "@/types";
import { MIN_FIRST_TARGET_RR } from "@/types";
import { analyzeTechnical } from "@/lib/analysis/technical";

/**
 * The invariant these tests exist for: the engine must never publish a first
 * target that pays less than the trade risks.
 *
 * The bug they lock down produced "1 : 0.2" on a positive verdict. It happened
 * whenever a resistance level sat close overhead, because target 1 was
 * overwritten with that level and its R multiple recomputed from whatever the
 * distance happened to be. That is the single most common chart location for a
 * stock that has just run — which is to say, exactly when someone is looking.
 */

const HORIZONS: Horizon[] = ["swing", "positional"];

/** Deterministic PRNG so a failure is always reproducible from its seed. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function series(
  seed: number,
  bars: number,
  shape: (i: number, rand: () => number) => number,
): Candle[] {
  const rand = rng(seed);
  const out: Candle[] = [];
  const start = Date.UTC(2019, 0, 2, 3, 45);

  for (let i = 0; i < bars; i += 1) {
    const close = Math.max(1, shape(i, rand));
    const wick = close * (0.004 + rand() * 0.012);
    const open = close * (1 + (rand() - 0.5) * 0.01);
    out.push({
      time: start + i * 24 * 60 * 60 * 1000,
      open,
      high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick,
      close,
      volume: Math.round(200_000 + rand() * 800_000),
    });
  }
  return out;
}

/**
 * A rise that stalls under a hard ceiling and keeps failing there.
 *
 * This is the Kaynes shape: repeated rejections build a heavy resistance
 * level, then price sits a percent or two beneath it. ATR is wide enough that
 * a 2×ATR stop is several percent away, so the distance to the ceiling divided
 * by the risk is a fraction — which is where 1:0.2 came from.
 */
function stalledUnderCeiling(seed: number, ceiling: number, bars = 420): Candle[] {
  return series(seed, bars, (i, rand) => {
    const ramp = Math.min(1, i / (bars * 0.55));
    const base = ceiling * (0.55 + 0.44 * ramp);
    if (i > bars * 0.55) {
      // Four visits to the ceiling, each rejected, ending just below it.
      const phase = Math.sin((i - bars * 0.55) / 9);
      return ceiling * (0.972 + 0.026 * Math.max(0, phase)) * (1 + (rand() - 0.5) * 0.006);
    }
    return base * (1 + (rand() - 0.5) * 0.018);
  });
}

const SHAPES: { name: string; candles: Candle[] }[] = [
  { name: "steady uptrend", candles: series(11, 500, (i, r) => 100 * Math.pow(1.0022, i) * (1 + (r() - 0.5) * 0.02)) },
  { name: "steady downtrend", candles: series(12, 500, (i, r) => 900 * Math.pow(0.9978, i) * (1 + (r() - 0.5) * 0.02)) },
  { name: "flat range", candles: series(13, 500, (i, r) => 500 * (1 + Math.sin(i / 14) * 0.05) * (1 + (r() - 0.5) * 0.01)) },
  { name: "violent whipsaw", candles: series(14, 500, (i, r) => 300 * (1 + Math.sin(i / 5) * 0.22) * (1 + (r() - 0.5) * 0.07)) },
  { name: "parabolic blow-off", candles: series(15, 500, (i, r) => 50 * Math.pow(1.006, i) * (1 + (r() - 0.5) * 0.03)) },
  { name: "crash then base", candles: series(16, 500, (i, r) => (i < 200 ? 1000 - i * 3.5 : 300 * (1 + Math.sin(i / 20) * 0.04)) * (1 + (r() - 0.5) * 0.02)) },
  { name: "penny-stock scale", candles: series(17, 500, (i, r) => 4 * Math.pow(1.0015, i) * (1 + (r() - 0.5) * 0.04)) },
  { name: "large-cap scale", candles: series(18, 500, (i, r) => 42_000 * Math.pow(1.0008, i) * (1 + (r() - 0.5) * 0.012)) },
  { name: "stalled under ceiling (Kaynes shape)", candles: stalledUnderCeiling(19, 5_200) },
  { name: "stalled under ceiling, low ATR", candles: series(20, 420, (i, r) => (i > 230 ? 998 * (1 + (r() - 0.5) * 0.003) : 700 + i * 1.3)) },
  { name: "breakout to blue sky", candles: series(21, 500, (i, r) => (i < 400 ? 250 * (1 + Math.sin(i / 16) * 0.03) : 250 * (1 + (i - 400) * 0.004)) * (1 + (r() - 0.5) * 0.015)) },
];

// Plus a spread of randomly-shaped series, so the invariant is not only
// checked against the shapes someone thought to write down.
for (let seed = 100; seed < 160; seed += 1) {
  const rand = rng(seed);
  const drift = (rand() - 0.45) * 0.006;
  const noise = 0.005 + rand() * 0.06;
  const level = 5 + rand() * 20_000;
  const cycle = 4 + rand() * 40;
  SHAPES.push({
    name: `random series #${seed}`,
    candles: series(seed, 320 + Math.floor(rand() * 300), (i, r) =>
      level * Math.pow(1 + drift, i) * (1 + Math.sin(i / cycle) * 0.09) * (1 + (r() - 0.5) * noise),
    ),
  });
}

describe("trade plan: reward-to-risk floor", () => {
  for (const horizon of HORIZONS) {
    it(`never publishes a first target below 1:${MIN_FIRST_TARGET_RR} on a ${horizon} plan`, () => {
      let checked = 0;

      for (const { name, candles } of SHAPES) {
        const analysis = analyzeTechnical("TEST.NS", candles, horizon, horizon === "swing" ? "daily" : "weekly");
        if (!analysis?.plan) continue;
        const plan = analysis.plan;
        checked += 1;

        assert.ok(
          Number.isFinite(plan.riskRewardRatio),
          `${name} / ${horizon}: riskRewardRatio is not finite (${plan.riskRewardRatio})`,
        );
        assert.ok(
          plan.riskRewardRatio >= MIN_FIRST_TARGET_RR - 1e-9,
          `${name} / ${horizon}: first-target RR is 1:${plan.riskRewardRatio.toFixed(2)}, below the ${MIN_FIRST_TARGET_RR} floor`,
        );

        for (const target of plan.targets) {
          assert.ok(
            target.rMultiple >= MIN_FIRST_TARGET_RR - 1e-9,
            `${name} / ${horizon}: ${target.label} is ${target.rMultiple.toFixed(2)}R, below the floor`,
          );
        }
      }

      assert.ok(checked >= 8, `only ${checked} plans were produced — the fixture set is not exercising the builder`);
    });

    it(`produces a coherent ladder on a ${horizon} plan`, () => {
      for (const { name, candles } of SHAPES) {
        const analysis = analyzeTechnical("TEST.NS", candles, horizon, horizon === "swing" ? "daily" : "weekly");
        const plan = analysis?.plan;
        if (!plan) continue;

        assert.ok(plan.stopLoss > 0, `${name}: stop is not a positive price`);
        assert.ok(plan.stopLoss < plan.entryLow, `${name}: stop ${plan.stopLoss} is not below entry ${plan.entryLow}`);
        assert.ok(plan.entryLow <= plan.entryHigh, `${name}: entry band is inverted`);
        assert.ok(plan.stopPercent > 0 && plan.stopPercent < 100, `${name}: stop distance ${plan.stopPercent}% is not sane`);

        for (let i = 1; i < plan.targets.length; i += 1) {
          assert.ok(
            plan.targets[i].price > plan.targets[i - 1].price,
            `${name}: ${plan.targets[i].label} (${plan.targets[i].price}) does not exceed ${plan.targets[i - 1].label} (${plan.targets[i - 1].price})`,
          );
          assert.ok(
            plan.targets[i].rMultiple > plan.targets[i - 1].rMultiple,
            `${name}: R multiples do not increase up the ladder`,
          );
        }

        for (const target of plan.targets) {
          assert.ok(Number.isFinite(target.price) && target.price > 0, `${name}: ${target.label} price is not sane`);
          assert.ok(Number.isFinite(target.gainPercent), `${name}: ${target.label} gain is not finite`);
          assert.ok(target.gainPercent > 0, `${name}: ${target.label} is not above the entry`);
          assert.ok(target.basis.length > 0, `${name}: ${target.label} carries no stated basis`);
        }

        assert.ok(Number.isFinite(plan.atr) && plan.atr > 0, `${name}: ATR is not sane`);
        assert.ok(plan.positionSizeExample.shares >= 0, `${name}: negative share count`);
      }
    });
  }

  it("declines rather than degrading when resistance sits right overhead", () => {
    // Sized so a 2xATR stop is materially further away than the ceiling: the
    // exact geometry that used to yield a sub-1 ratio.
    const candles = stalledUnderCeiling(77, 5_200);
    const analysis = analyzeTechnical("KAYNES.NS", candles, "swing", "daily");
    assert.ok(analysis, "analysis should be produced");

    if (analysis!.plan && analysis!.plan.status === "wait") {
      const wait = analysis!.plan.wait;
      assert.ok(wait, "a wait plan must carry its wait block");
      assert.ok(wait!.rrIfEnteredNow < MIN_FIRST_TARGET_RR, "the wait plan should record the ratio it rejected");
      assert.ok(wait!.idealEntry > 0, "the wait plan must name a limit level");
      assert.ok(
        wait!.breakoutTrigger > wait!.blockingResistance,
        "the breakout trigger must sit above the level it clears",
      );
      assert.ok(wait!.steps.length >= 2, "a wait plan must offer both branches");
      assert.ok(
        analysis!.plan.riskRewardRatio >= MIN_FIRST_TARGET_RR - 1e-9,
        "even a wait plan must quote a ratio at or above the floor",
      );
    }
  });

  it("gives a positional plan a materially larger tail than a swing plan", () => {
    const candles = series(31, 600, (i, r) => 100 * Math.pow(1.0018, i) * (1 + (r() - 0.5) * 0.02));

    const swing = analyzeTechnical("TEST.NS", candles, "swing", "daily")?.plan;
    const positional = analyzeTechnical("TEST.NS", candles, "positional", "weekly")?.plan;

    if (swing && positional && swing.targets.length > 0 && positional.targets.length > 0) {
      const swingTail = swing.targets[swing.targets.length - 1].rMultiple;
      const positionalTail = positional.targets[positional.targets.length - 1].rMultiple;
      assert.ok(
        positionalTail >= swingTail,
        `positional tail ${positionalTail.toFixed(1)}R should not be smaller than swing's ${swingTail.toFixed(1)}R`,
      );
    }
  });

  it("flags a positional ladder too small to be worth the hold", () => {
    // A tight, going-nowhere range: the ratio can be fine while the absolute
    // payoff is not worth locking capital up for a year.
    const candles = series(41, 600, (i, r) => 1_000 * (1 + Math.sin(i / 30) * 0.012) * (1 + (r() - 0.5) * 0.004));
    const plan = analyzeTechnical("TEST.NS", candles, "positional", "weekly")?.plan;

    if (plan && plan.status === "actionable" && plan.totalUpsidePercent < 25) {
      assert.ok(plan.rewardNote, "a small positional payoff should be called out, not left implicit");
    }
  });
});

describe("narrative", () => {
  it("is delivered as labelled points, not one paragraph", () => {
    const candles = series(51, 500, (i, r) => 100 * Math.pow(1.002, i) * (1 + (r() - 0.5) * 0.02));
    const analysis = analyzeTechnical("TEST.NS", candles, "swing", "daily");
    assert.ok(analysis);

    const points = analysis!.narrativePoints;
    assert.ok(points.length >= 4, `expected several points, got ${points.length}`);

    for (const point of points) {
      assert.ok(point.label.length > 0 && point.label.length <= 24, `label "${point.label}" is not a short heading`);
      assert.ok(point.text.length > 0, `point "${point.label}" has no text`);
      assert.ok(
        point.text.length <= 320,
        `point "${point.label}" runs to ${point.text.length} chars — that is a paragraph again`,
      );
      assert.ok(["bullish", "bearish", "neutral"].includes(point.tone), "tone must be one of the three");
    }

    assert.equal(new Set(points.map((p) => p.label)).size, points.length, "labels should not repeat");
  });

  it("does not offer an entry price for a plan it has declined", () => {
    for (const { candles } of SHAPES) {
      const analysis = analyzeTechnical("TEST.NS", candles, "swing", "daily");
      const plan = analysis?.plan;
      if (!plan || plan.status !== "wait") continue;

      const planPoint = analysis!.narrativePoints.find((p) => p.label === "The plan");
      assert.equal(planPoint, undefined, "a wait plan must not be narrated as an entry");
      assert.ok(
        analysis!.narrativePoints.some((p) => p.label === "Not yet"),
        "a wait plan must be narrated as such",
      );
    }
  });
});

describe("fundamental narrative", () => {
  it("is delivered as labelled points covering all six areas", async () => {
    const { sampleFundamentals } = await import("@/lib/data/sample");
    const { analyzeFundamental } = await import("@/lib/analysis/fundamental");

    const analysis = analyzeFundamental(sampleFundamentals("RELIANCE.NS"));
    const points = analysis.narrativePoints;

    assert.ok(points.length >= 7, `expected the call plus six areas, got ${points.length}`);
    assert.equal(points[0].label, "The call", "the verdict should lead");

    for (const expected of ["Growth", "Profitability", "Balance sheet", "Cash flow", "Valuation", "Shareholding"]) {
      assert.ok(
        points.some((p) => p.label === expected),
        `no point covers ${expected}`,
      );
    }

    for (const point of points) {
      assert.ok(point.label.length > 0 && point.label.length <= 24, `label "${point.label}" is not a short heading`);
      assert.ok(point.text.length > 0, `point "${point.label}" has no text`);
      assert.ok(
        point.text.length <= 400,
        `point "${point.label}" runs to ${point.text.length} chars — that is a paragraph again`,
      );
      assert.ok(["bullish", "bearish", "neutral"].includes(point.tone), "tone must be one of the three");
    }

    assert.equal(new Set(points.map((p) => p.label)).size, points.length, "labels should not repeat");
    // The prose form is still built, because the API and the overview card use it.
    assert.ok(analysis.narrative.length > 100, "the prose summary should still exist");
  });

  it("names absent statements instead of scoring them silently", async () => {
    const { sampleFundamentals } = await import("@/lib/data/sample");
    const { analyzeFundamental } = await import("@/lib/analysis/fundamental");

    // Exactly the shape the NSE dataset produces: quarterly P&L and
    // shareholding present, balance sheet and cash flow absent.
    const bare = sampleFundamentals("TEST.NS");
    bare.balanceSheet = [];
    bare.cashFlow = [];

    const gap = analyzeFundamental(bare).narrativePoints.find((p) => p.label === "Data gaps");
    assert.ok(gap, "missing statements must be called out");
    assert.match(gap!.text, /balance sheet/i);
    assert.match(gap!.text, /cash flow/i);

    // And the opposite: a complete snapshot should not manufacture a warning.
    const full = analyzeFundamental(sampleFundamentals("RELIANCE.NS"));
    assert.equal(
      full.narrativePoints.find((p) => p.label === "Data gaps"),
      undefined,
      "a complete snapshot should carry no gap notice",
    );
  });
});
