/**
 * Shows what the old builder produced and what the new one produces on the
 * same chart. The old logic is reimplemented verbatim here so the comparison
 * is against the actual shipped behaviour, not a description of it.
 */
import { atr, latest, supportResistance } from "@/lib/indicators";
import { analyzeTechnical } from "@/lib/analysis/technical";

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** A rise that stalls just under a heavily-rejected ceiling. */
function stalledUnderCeiling(seed, ceiling, bars = 420) {
  const rand = rng(seed);
  const out = [];
  const start = Date.UTC(2019, 0, 2, 3, 45);
  for (let i = 0; i < bars; i += 1) {
    let close;
    if (i > bars * 0.55) {
      const phase = Math.sin((i - bars * 0.55) / 9);
      close = ceiling * (0.972 + 0.026 * Math.max(0, phase)) * (1 + (rand() - 0.5) * 0.006);
    } else {
      const ramp = Math.min(1, i / (bars * 0.55));
      close = ceiling * (0.55 + 0.44 * ramp) * (1 + (rand() - 0.5) * 0.018);
    }
    const wick = close * (0.004 + rand() * 0.012);
    const open = close * (1 + (rand() - 0.5) * 0.01);
    out.push({
      time: start + i * 86_400_000,
      open,
      high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick,
      close,
      volume: 500_000,
    });
  }
  return out;
}

/** The builder exactly as it was before the fix. */
function oldBuildTradePlan(data, horizon) {
  const price = data[data.length - 1].close;
  const atrValue = latest(atr(data, 14));
  if (atrValue === null || atrValue <= 0 || price <= 0) return null;

  const stopMultiplier = horizon === "swing" ? 2 : 3;
  const stopLoss = price - atrValue * stopMultiplier;
  const risk = price - stopLoss;
  if (risk <= 0) return null;

  const levels = supportResistance(data, price, 1.5, horizon === "swing" ? 5 : 8);
  const nearestResistance = levels.resistances[0];

  const targetMultiples = horizon === "swing" ? [1.5, 2.5, 4] : [2, 4, 6];
  const targets = targetMultiples.map((r, i) => {
    const targetPrice = price + risk * r;
    return { label: `Target ${i + 1}`, price: targetPrice, rMultiple: r };
  });

  if (nearestResistance && nearestResistance.price > price && nearestResistance.price < targets[0].price) {
    targets[0] = {
      label: "Target 1 (resistance)",
      price: nearestResistance.price,
      rMultiple: (nearestResistance.price - price) / risk,
    };
  }

  return { price, stopLoss, targets, riskRewardRatio: targets[0].rMultiple };
}

const fixtures = [
  ["ceiling at 5,200 (Kaynes-like)", stalledUnderCeiling(19, 5_200)],
  ["ceiling at 990", stalledUnderCeiling(23, 990)],
  ["ceiling at 148", stalledUnderCeiling(29, 148)],
  ["ceiling at 31,400", stalledUnderCeiling(31, 31_400)],
];

for (const horizon of ["swing", "positional"]) {
  console.log(`\n${"=".repeat(78)}\n  ${horizon.toUpperCase()}\n${"=".repeat(78)}`);

  for (const [name, candles] of fixtures) {
    const timeframe = horizon === "swing" ? "daily" : "weekly";
    const before = oldBuildTradePlan(
      horizon === "swing" ? candles : resampleWeekly(candles),
      horizon,
    );
    const after = analyzeTechnical("X.NS", candles, horizon, timeframe)?.plan;

    console.log(`\n${name}`);
    if (before) {
      const flag = before.riskRewardRatio < 1 ? "  <-- unusable" : "";
      console.log(
        `  before   RR 1:${before.riskRewardRatio.toFixed(2)}${flag}   ` +
          `stop ${before.stopLoss.toFixed(2)}  T1 ${before.targets[0].price.toFixed(2)}  ` +
          `ladder ${before.targets.map((t) => `${t.rMultiple.toFixed(1)}R`).join(" -> ")}`,
      );
    } else {
      console.log("  before   (no plan)");
    }

    if (after) {
      console.log(
        `  after    RR 1:${after.riskRewardRatio.toFixed(2)}   status ${after.status}   ` +
          `stop ${after.stopLoss.toFixed(2)}  ` +
          (after.targets.length
            ? `T1 ${after.targets[0].price.toFixed(2)}  ladder ${after.targets.map((t) => `${t.rMultiple.toFixed(1)}R`).join(" -> ")}`
            : "no ladder published"),
      );
      if (after.wait) {
        console.log(`           entry now would be 1:${after.wait.rrIfEnteredNow.toFixed(2)} -> waits for ${after.wait.idealEntry.toFixed(2)}, or a break of ${after.wait.breakoutTrigger.toFixed(2)}`);
      }
    } else {
      console.log("  after    (no plan — verdict is reduce/avoid)");
    }
  }
}

function resampleWeekly(candles) {
  const out = [];
  let bucket = null;
  for (const c of candles) {
    const d = new Date(c.time);
    const day = d.getUTCDay();
    const monday = c.time - ((day + 6) % 7) * 86_400_000;
    if (!bucket || bucket.time !== monday) {
      if (bucket) out.push(bucket);
      bucket = { ...c, time: monday };
    } else {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

console.log("");
