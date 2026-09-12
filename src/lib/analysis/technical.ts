import type {
  Candle,
  Horizon,
  NarrativePoint,
  SignalDirection,
  SignalGroup,
  SignalReading,
  TechnicalAnalysis,
  Timeframe,
  TradePlan,
  TradeTarget,
  Verdict,
} from "@/types";
import { MIN_FIRST_TARGET_RR } from "@/types";
import {
  adx,
  atr,
  bollingerBands,
  bollingerWidth,
  ema,
  historicalVolatility,
  latest,
  macd,
  marketStructure,
  mfi,
  obv,
  resample,
  roc,
  rsi,
  sma,
  stochastic,
  supertrend,
  supportResistance,
  valueAgo,
  volumeSma,
} from "@/lib/indicators";

/**
 * Technical analysis engine.
 *
 * The core idea: every indicator is converted onto a common -100..+100 scale,
 * grouped into five themes, then blended into one composite score with weights
 * that CHANGE BY HORIZON. A swing trader and a positional investor looking at
 * the same chart should not get the same answer, and here they don't:
 *
 *   - Swing weights momentum and short-term structure more heavily.
 *   - Positional weights long-term trend and relative strength more heavily.
 *
 * Everything is derived from daily/weekly/monthly candles. There is no
 * intraday path anywhere in this engine, by design.
 */

const clamp = (v: number, lo = -100, hi = 100): number => Math.max(lo, Math.min(hi, v));

function directionOf(score: number): SignalDirection {
  if (score >= 20) return "bullish";
  if (score <= -20) return "bearish";
  return "neutral";
}

function fmt(v: number | null, digits = 2, suffix = ""): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}${suffix}`;
}

/** Horizon-specific group weights. These sum to 1 within each horizon. */
const GROUP_WEIGHTS: Record<Horizon, Record<string, number>> = {
  swing: {
    trend: 0.28,
    momentum: 0.30,
    structure: 0.18,
    volume: 0.14,
    volatility: 0.10,
  },
  positional: {
    trend: 0.40,
    momentum: 0.18,
    structure: 0.22,
    volume: 0.12,
    volatility: 0.08,
  },
};

// ---------------------------------------------------------------------------
// Group builders
// ---------------------------------------------------------------------------

function buildTrendGroup(data: Candle[], horizon: Horizon): SignalGroup {
  const price = data[data.length - 1].close;
  const readings: SignalReading[] = [];

  const ema20 = latest(ema(data, 20));
  const ema50 = latest(ema(data, 50));
  const ema200 = latest(ema(data, 200));
  const sma50 = latest(sma(data, 50));

  // --- Moving average alignment: the single most important trend read -------
  if (ema20 !== null && ema50 !== null && ema200 !== null) {
    const perfectBull = price > ema20 && ema20 > ema50 && ema50 > ema200;
    const perfectBear = price < ema20 && ema20 < ema50 && ema50 < ema200;
    let score: number;
    let conclusion: string;

    if (perfectBull) {
      score = 90;
      conclusion =
        "Textbook bullish stack: price above the 20 EMA, which sits above the 50, which sits above the 200. Pullbacks into these averages are where trend-followers look to add rather than exit.";
    } else if (perfectBear) {
      score = -90;
      conclusion =
        "Textbook bearish stack: price below the 20 EMA, which sits below the 50, which sits below the 200. Rallies into these averages have been selling opportunities, not reversals.";
    } else if (price > ema200 && ema50 > ema200) {
      score = 45;
      conclusion =
        "The long-term uptrend is intact — price and the 50 EMA both hold above the 200 — but the short-term alignment has broken. This is the signature of a pullback inside a larger uptrend.";
    } else if (price < ema200 && ema50 < ema200) {
      score = -45;
      conclusion =
        "The long-term downtrend remains in control with price and the 50 EMA below the 200. Any strength here is counter-trend until the 200 is reclaimed.";
    } else {
      score = price > ema50 ? 15 : -15;
      conclusion =
        "The moving averages are tangled rather than stacked, which is what a transition or a range looks like. Trend-following setups have a poor edge until the averages separate again.";
    }

    readings.push({
      key: "ma-alignment",
      label: "Moving average alignment",
      display: perfectBull ? "Bullish stack" : perfectBear ? "Bearish stack" : "Mixed",
      raw: null,
      direction: directionOf(score),
      score,
      weight: horizon === "positional" ? 3 : 2.2,
      conclusion,
    });
  }

  // --- Price vs 200 EMA: the institutional dividing line --------------------
  if (ema200 !== null) {
    const distance = ((price - ema200) / ema200) * 100;
    const score = clamp(distance * 4);
    readings.push({
      key: "price-vs-200ema",
      label: "Price vs 200 EMA",
      display: `${distance >= 0 ? "+" : ""}${distance.toFixed(1)}%`,
      raw: distance,
      direction: directionOf(score),
      score,
      weight: horizon === "positional" ? 2.5 : 1.5,
      conclusion:
        distance > 15
          ? `Price is ${distance.toFixed(1)}% above its 200 EMA. The trend is healthy, but stretched extensions like this typically mean-revert before the next sustainable leg — a poor spot for a fresh full-size entry.`
          : distance > 0
            ? `Price holds ${distance.toFixed(1)}% above the 200 EMA, the level most long-term money uses to separate bull from bear. Constructive, and not yet extended.`
            : distance > -10
              ? `Price sits ${Math.abs(distance).toFixed(1)}% below the 200 EMA. This is the contested zone — reclaiming it would be the first genuine sign of repair.`
              : `Price is ${Math.abs(distance).toFixed(1)}% below the 200 EMA. Structurally damaged; positional buyers usually wait for a reclaim rather than catching the falling knife.`,
    });
  }

  // --- ADX: is there a trend worth following at all? ------------------------
  const adxResult = adx(data, 14);
  const adxValue = latest(adxResult.adx);
  const plusDi = latest(adxResult.plusDi);
  const minusDi = latest(adxResult.minusDi);

  if (adxValue !== null && plusDi !== null && minusDi !== null) {
    const bullish = plusDi > minusDi;
    // ADX measures strength, not direction — so magnitude scales with ADX and
    // sign comes from the DI spread.
    const strengthFactor = Math.min(adxValue / 40, 1.4);
    const score = clamp((bullish ? 1 : -1) * strengthFactor * 65);

    let conclusion: string;
    if (adxValue < 20) {
      conclusion = `ADX at ${adxValue.toFixed(1)} means there is no real trend to ride — price is chopping. Breakout and trend-following entries fail most often in exactly this regime; range tactics or standing aside are the honest answers.`;
    } else if (adxValue < 25) {
      conclusion = `ADX at ${adxValue.toFixed(1)} shows a trend that is forming but not yet confirmed. ${bullish ? "+DI leads, so the tilt is upward" : "-DI leads, so the tilt is downward"}, but wait for ADX above 25 before sizing up.`;
    } else if (adxValue < 40) {
      conclusion = `ADX at ${adxValue.toFixed(1)} confirms a genuine ${bullish ? "up" : "down"}trend with ${bullish ? "+DI" : "-DI"} clearly in control. This is the healthiest regime for ${bullish ? "swing longs and positional holds" : "staying defensive"}.`;
    } else {
      conclusion = `ADX at ${adxValue.toFixed(1)} signals a very strong ${bullish ? "up" : "down"}trend. Powerful, but readings this high are usually late-stage — trends often consolidate soon after ADX peaks, so chase carefully.`;
    }

    readings.push({
      key: "adx14",
      label: "ADX (14)",
      display: adxValue.toFixed(1),
      raw: adxValue,
      direction: directionOf(score),
      score,
      weight: 2.5,
      conclusion,
    });
  }

  // --- Supertrend: a clean binary regime flag ------------------------------
  const st = supertrend(data, 10, 3);
  if (st.length > 0) {
    const last = st[st.length - 1];
    const score = last.direction === 1 ? 60 : -60;
    const distance = ((price - last.value) / price) * 100;
    readings.push({
      key: "supertrend",
      label: "Supertrend (10, 3)",
      display: last.direction === 1 ? "Bullish" : "Bearish",
      raw: last.value,
      direction: directionOf(score),
      score,
      weight: 1.8,
      conclusion:
        last.direction === 1
          ? `Supertrend is bullish with its trailing stop at ${last.value.toFixed(2)}, currently ${Math.abs(distance).toFixed(1)}% below price. That level is a mechanical exit — losing it flips the regime.`
          : `Supertrend is bearish with resistance at ${last.value.toFixed(2)}, ${Math.abs(distance).toFixed(1)}% above price. Long setups lack confirmation until price closes back above it.`,
    });
  }

  void sma50;

  const score = weightedScore(readings);
  return {
    key: "trend",
    label: "Trend",
    description: "Direction and strength of the prevailing move",
    score,
    direction: directionOf(score),
    readings,
    summary: summariseGroup("trend", score, readings),
  };
}

function buildMomentumGroup(data: Candle[], horizon: Horizon): SignalGroup {
  const readings: SignalReading[] = [];

  // --- RSI, read as trend context rather than naive overbought/oversold ----
  const rsiSeries = rsi(data, 14);
  const rsiValue = latest(rsiSeries);
  const rsiPrev = valueAgo(rsiSeries, 5);

  if (rsiValue !== null) {
    let score: number;
    let conclusion: string;

    if (rsiValue >= 70) {
      score = 25;
      conclusion = `RSI at ${rsiValue.toFixed(1)} is technically overbought, but in a swing/positional context that is a strength signal, not a sell trigger — strong trends stay overbought for weeks. Treat it as a caution against adding size, not as a reason to exit a working position.`;
    } else if (rsiValue >= 60) {
      score = 70;
      conclusion = `RSI at ${rsiValue.toFixed(1)} sits in the sweet spot for trend continuation. In healthy uptrends RSI oscillates between 40 and 80, and this reading confirms buyers are in control without being exhausted.`;
    } else if (rsiValue >= 50) {
      score = 40;
      conclusion = `RSI at ${rsiValue.toFixed(1)} is modestly bullish. Momentum favours the upside, but it lacks the conviction of a 60+ reading — a supporting signal rather than a leading one.`;
    } else if (rsiValue >= 40) {
      score = -15;
      conclusion = `RSI at ${rsiValue.toFixed(1)} is in no-man's land. The 40 level is the key line: uptrends usually hold above it on pullbacks, so this is the zone where a dip either gets bought or turns into something worse.`;
    } else if (rsiValue >= 30) {
      score = -45;
      conclusion = `RSI at ${rsiValue.toFixed(1)} shows momentum has broken down. Losing the 40 floor typically marks a shift from uptrend pullback to genuine downtrend.`;
    } else {
      score = -25;
      conclusion = `RSI at ${rsiValue.toFixed(1)} is deeply oversold. Bounces from here are common but usually counter-trend — a positional buyer wants to see a base form and RSI reclaim 40+ before treating it as an opportunity.`;
    }

    if (rsiPrev !== null) {
      const delta = rsiValue - rsiPrev;
      if (Math.abs(delta) > 8) {
        score = clamp(score + Math.sign(delta) * 10);
        conclusion += ` Momentum is also ${delta > 0 ? "accelerating" : "deteriorating"} quickly — RSI has moved ${Math.abs(delta).toFixed(1)} points in five sessions.`;
      }
    }

    readings.push({
      key: "rsi14",
      label: "RSI (14)",
      display: rsiValue.toFixed(1),
      raw: rsiValue,
      direction: directionOf(score),
      score,
      weight: horizon === "swing" ? 3 : 2,
      conclusion,
    });
  }

  // --- MACD ---------------------------------------------------------------
  const macdResult = macd(data, 12, 26, 9);
  const macdValue = latest(macdResult.macd);
  const signalValue = latest(macdResult.signal);
  const histValue = latest(macdResult.histogram);
  const histPrev = valueAgo(macdResult.histogram, 3);

  if (macdValue !== null && signalValue !== null && histValue !== null) {
    const above = macdValue > signalValue;
    const expanding = histPrev !== null && Math.abs(histValue) > Math.abs(histPrev);
    const score = clamp((above ? 55 : -55) + (expanding ? (above ? 15 : -15) : 0) + (macdValue > 0 ? 10 : -10));

    readings.push({
      key: "macd",
      label: "MACD (12, 26, 9)",
      display: `${macdValue.toFixed(2)} / ${signalValue.toFixed(2)}`,
      raw: macdValue,
      direction: directionOf(score),
      score,
      weight: 2.2,
      conclusion: above
        ? `MACD is above its signal line with the histogram ${expanding ? "expanding" : "flattening"}, and the line itself sits ${macdValue > 0 ? "above" : "below"} zero. ${expanding ? "Expanding histogram means the move is gaining force, which supports holding through noise." : "A flattening histogram is the first hint that the current leg is tiring — not a sell, but a reason to tighten stops."}`
        : `MACD sits below its signal line with the histogram ${expanding ? "expanding to the downside" : "contracting"}. ${expanding ? "Downside momentum is building; fresh longs are fighting the tape." : "The selling pressure is easing, which often precedes a base — but a crossover back above signal is the confirmation to wait for."}`,
    });
  }

  // --- Rate of change over horizon-appropriate windows ---------------------
  const rocPeriod = horizon === "swing" ? 20 : 60;
  const rocValue = roc(data, rocPeriod);
  if (rocValue !== null) {
    const score = clamp(rocValue * (horizon === "swing" ? 4 : 2));
    readings.push({
      key: `roc${rocPeriod}`,
      label: `${rocPeriod}-day rate of change`,
      display: `${rocValue >= 0 ? "+" : ""}${rocValue.toFixed(1)}%`,
      raw: rocValue,
      direction: directionOf(score),
      score,
      weight: 1.5,
      conclusion: `Price has moved ${rocValue >= 0 ? "up" : "down"} ${Math.abs(rocValue).toFixed(1)}% over the last ${rocPeriod} sessions — the window that matters for a ${horizon === "swing" ? "1–6 week swing" : "multi-month positional"} view. ${Math.abs(rocValue) > 25 ? "A move this size in this window is unusual and raises the odds of consolidation before continuation." : "That is a measured pace, which tends to be more sustainable than a vertical move."}`,
    });
  }

  // --- Stochastic: useful for timing entries within an established trend ----
  const stoch = stochastic(data, 14, 3);
  const kValue = latest(stoch.k);
  const dValue = latest(stoch.d);
  if (kValue !== null && dValue !== null) {
    const score = clamp((kValue - 50) * 1.4 + (kValue > dValue ? 12 : -12));
    readings.push({
      key: "stochastic",
      label: "Stochastic (14, 3)",
      display: `%K ${kValue.toFixed(1)}`,
      raw: kValue,
      direction: directionOf(score),
      score,
      weight: 1.2,
      conclusion:
        kValue < 20
          ? `Stochastic at ${kValue.toFixed(1)} is oversold. Within an intact uptrend this is precisely the pullback timing signal swing traders wait for; within a downtrend it is noise.`
          : kValue > 80
            ? `Stochastic at ${kValue.toFixed(1)} is overbought, meaning the immediate entry timing is poor even if the larger trend is sound. Waiting for a reset toward 40–50 usually improves the risk/reward materially.`
            : `Stochastic at ${kValue.toFixed(1)} is mid-range with %K ${kValue > dValue ? "above" : "below"} %D, offering no strong timing edge either way right now.`,
    });
  }

  const score = weightedScore(readings);
  return {
    key: "momentum",
    label: "Momentum",
    description: "Speed and conviction behind the current move",
    score,
    direction: directionOf(score),
    readings,
    summary: summariseGroup("momentum", score, readings),
  };
}

function buildStructureGroup(data: Candle[], horizon: Horizon): SignalGroup {
  const readings: SignalReading[] = [];
  const price = data[data.length - 1].close;

  // --- Swing structure (HH/HL etc.) ---------------------------------------
  const structure = marketStructure(data, horizon === "swing" ? 5 : 10);
  if (structure.pattern !== "insufficient") {
    const map: Record<string, number> = { "HH-HL": 80, "LH-LL": -80, "HH-LL": -10, "LH-HL": 10 };
    const score = map[structure.pattern] ?? 0;
    readings.push({
      key: "swing-structure",
      label: "Swing structure",
      display: structure.pattern,
      raw: null,
      direction: directionOf(score),
      score,
      weight: 2.5,
      conclusion:
        structure.pattern === "HH-HL"
          ? "Price is printing higher highs and higher lows — the literal definition of an uptrend. As long as the most recent higher low holds, the structure is intact and dips are buyable."
          : structure.pattern === "LH-LL"
            ? "Price is printing lower highs and lower lows, the definition of a downtrend. Each rally has failed lower; that pattern must break before long setups have any structural support."
            : structure.pattern === "HH-LL"
              ? "The range is expanding — both a higher high and a lower low. Rising volatility with no directional resolution; position sizes should be smaller here, not larger."
              : "The range is contracting into a lower high and higher low. Compression like this usually resolves into a decisive move; the direction of the breakout is the trade, not the current drift.",
    });
  }

  // --- 52-week position ---------------------------------------------------
  const window = data.slice(-252);
  const high52 = Math.max(...window.map((c) => c.high));
  const low52 = Math.min(...window.map((c) => c.low));
  const range = high52 - low52;
  const position = range === 0 ? 50 : ((price - low52) / range) * 100;
  const fromHigh = ((price - high52) / high52) * 100;

  const positionScore = clamp((position - 50) * 1.6);
  readings.push({
    key: "52w-position",
    label: "52-week range position",
    display: `${position.toFixed(0)}%`,
    raw: position,
    direction: directionOf(positionScore),
    score: positionScore,
    weight: horizon === "positional" ? 2.2 : 1.6,
    conclusion:
      position > 85
        ? `Price sits in the top ${(100 - position).toFixed(0)}% of its 52-week range, ${Math.abs(fromHigh).toFixed(1)}% from the high. Counter-intuitively this is bullish — stocks making new highs tend to keep making them, which is the entire basis of momentum investing.`
        : position > 60
          ? `Price is in the upper half of its 52-week range and ${Math.abs(fromHigh).toFixed(1)}% below the high. Constructive positioning with room to run before hitting overhead supply.`
          : position > 35
            ? `Price sits mid-range, ${Math.abs(fromHigh).toFixed(1)}% off the 52-week high. Neither strength nor weakness — the range itself is the story until it breaks.`
            : `Price is in the bottom third of its 52-week range, ${Math.abs(fromHigh).toFixed(1)}% below the high. Statistically, buying weakness like this underperforms buying strength unless a clear base and reversal have formed.`,
  });

  // --- Distance to nearest support/resistance ------------------------------
  const levels = supportResistance(data, price, 1.5, horizon === "swing" ? 5 : 8);
  const nearestSupport = levels.supports[0];
  const nearestResistance = levels.resistances[0];

  if (nearestSupport && nearestResistance) {
    const toSupport = ((price - nearestSupport.price) / price) * 100;
    const toResistance = ((nearestResistance.price - price) / price) * 100;
    // Favourable when there's far more room up than down.
    const ratio = toResistance === 0 ? 0 : toSupport / toResistance;
    const score = clamp((1 - ratio) * 55);
    readings.push({
      key: "sr-position",
      label: "Support / resistance room",
      display: `${toSupport.toFixed(1)}% / ${toResistance.toFixed(1)}%`,
      raw: ratio,
      direction: directionOf(score),
      score,
      weight: 1.8,
      conclusion: `Nearest support sits ${toSupport.toFixed(1)}% below at ${nearestSupport.price.toFixed(2)}, with resistance ${toResistance.toFixed(1)}% above at ${nearestResistance.price.toFixed(2)}. ${ratio < 0.7 ? "That is a favourable location — limited downside to the shelf, more room to the ceiling." : ratio > 1.4 ? "That is an awkward location: you are buying close to resistance and far from support, which forces a wide stop for a small target." : "Roughly balanced, which means the level that breaks first will define the next move."}`,
    });
  }

  const score = weightedScore(readings);
  return {
    key: "structure",
    label: "Price structure",
    description: "Where price sits relative to its own history",
    score,
    direction: directionOf(score),
    readings,
    summary: summariseGroup("structure", score, readings),
  };
}

function buildVolumeGroup(data: Candle[]): SignalGroup {
  const readings: SignalReading[] = [];

  // --- Volume vs its own average ------------------------------------------
  const volAvg = latest(volumeSma(data, 50));
  const recentVol = data.slice(-5).reduce((a, c) => a + c.volume, 0) / 5;
  if (volAvg !== null && volAvg > 0) {
    const ratio = recentVol / volAvg;
    const priceChange5d = roc(data, 5) ?? 0;
    // High volume confirms whichever direction price is moving.
    const score = clamp(Math.sign(priceChange5d) * Math.min((ratio - 1) * 90, 70));
    readings.push({
      key: "volume-ratio",
      label: "Volume vs 50-day average",
      display: `${ratio.toFixed(2)}x`,
      raw: ratio,
      direction: directionOf(score),
      score,
      weight: 2,
      conclusion:
        ratio > 1.5
          ? `Recent volume is running ${ratio.toFixed(2)}x its 50-day average while price moved ${priceChange5d >= 0 ? "up" : "down"} ${Math.abs(priceChange5d).toFixed(1)}%. Heavy volume behind a move is institutional participation — it is what separates a real breakout from a fake one.`
          : ratio < 0.7
            ? `Volume is only ${ratio.toFixed(2)}x its average. Moves on thin volume lack conviction and are far more prone to reversal; treat any breakout here with suspicion until participation improves.`
            : `Volume is broadly average at ${ratio.toFixed(2)}x. No unusual accumulation or distribution is showing up in the tape.`,
    });
  }

  // --- OBV trend: are shares being accumulated or distributed? -------------
  const obvSeries = obv(data);
  const obvNow = latest(obvSeries);
  const obvPast = valueAgo(obvSeries, 40);
  if (obvNow !== null && obvPast !== null && obvPast !== 0) {
    const obvChange = ((obvNow - obvPast) / Math.abs(obvPast)) * 100;
    const priceChange = roc(data, 40) ?? 0;
    const diverging = Math.sign(obvChange) !== Math.sign(priceChange) && Math.abs(priceChange) > 3;
    const score = clamp(Math.sign(obvChange) * Math.min(Math.abs(obvChange) * 2, 60) - (diverging ? 25 : 0));

    readings.push({
      key: "obv-trend",
      label: "On-balance volume trend",
      display: `${obvChange >= 0 ? "+" : ""}${obvChange.toFixed(1)}%`,
      raw: obvChange,
      direction: directionOf(score),
      score,
      weight: 1.8,
      conclusion: diverging
        ? `OBV has moved ${obvChange >= 0 ? "up" : "down"} ${Math.abs(obvChange).toFixed(1)}% while price moved the other way over 40 sessions. This divergence matters: volume flow is contradicting the price move, which frequently precedes a reversal.`
        : `OBV is ${obvChange >= 0 ? "rising" : "falling"} in line with price over 40 sessions, confirming that volume is genuinely ${obvChange >= 0 ? "accumulating into strength" : "distributing into weakness"} rather than the move being driven by thin trade.`,
    });
  }

  // --- Money Flow Index ---------------------------------------------------
  const mfiValue = latest(mfi(data, 14));
  if (mfiValue !== null) {
    const score = clamp((mfiValue - 50) * 1.5);
    readings.push({
      key: "mfi14",
      label: "Money Flow Index (14)",
      display: mfiValue.toFixed(1),
      raw: mfiValue,
      direction: directionOf(score),
      score,
      weight: 1.3,
      conclusion:
        mfiValue > 80
          ? `MFI at ${mfiValue.toFixed(1)} shows heavy money inflow, bordering on overbought. Strong, but late entries here carry poor risk/reward.`
          : mfiValue < 20
            ? `MFI at ${mfiValue.toFixed(1)} shows capital leaving the stock. Oversold on flow, but falling knives need a flow reversal before they are worth catching.`
            : `MFI at ${mfiValue.toFixed(1)} indicates ${mfiValue > 50 ? "net inflow" : "net outflow"} of money at a normal, sustainable pace.`,
    });
  }

  const score = weightedScore(readings);
  return {
    key: "volume",
    label: "Volume & flow",
    description: "Whether real participation supports the move",
    score,
    direction: directionOf(score),
    readings,
    summary: summariseGroup("volume", score, readings),
  };
}

function buildVolatilityGroup(data: Candle[]): SignalGroup {
  const readings: SignalReading[] = [];
  const price = data[data.length - 1].close;

  // --- ATR as a percentage: the key input to position sizing ---------------
  const atrValue = latest(atr(data, 14));
  if (atrValue !== null && price > 0) {
    const atrPercent = (atrValue / price) * 100;
    // Moderate volatility is ideal for swing trading — too low means no move,
    // too high means unmanageable stops.
    const score = atrPercent < 1 ? -20 : atrPercent <= 3 ? 40 : atrPercent <= 5 ? 0 : -45;
    readings.push({
      key: "atr14",
      label: "ATR (14) as % of price",
      display: `${atrPercent.toFixed(2)}%`,
      raw: atrPercent,
      direction: directionOf(score),
      score,
      weight: 2.2,
      conclusion:
        atrPercent < 1
          ? `Daily range averages just ${atrPercent.toFixed(2)}% of price. Volatility this compressed rarely delivers swing-sized moves — but it often precedes an expansion, so it is worth watching for a breakout rather than trading the drift.`
          : atrPercent <= 3
            ? `Daily range averages ${atrPercent.toFixed(2)}% of price — the healthy band for swing trading. Wide enough to produce meaningful moves, tight enough that a sensible stop does not consume the whole position.`
            : atrPercent <= 5
              ? `Daily range averages ${atrPercent.toFixed(2)}%. Elevated volatility means stops must sit wider, so position size has to come down to keep risk constant.`
              : `Daily range averages ${atrPercent.toFixed(2)}% — very high. A stop placed correctly here would be so wide that most traders should either size down sharply or simply pass.`,
    });
  }

  // --- Bollinger bandwidth: squeeze detection -----------------------------
  const bands = bollingerBands(data, 20, 2);
  const widths = bollingerWidth(bands);
  const currentWidth = latest(widths);
  if (currentWidth !== null && widths.length > 100) {
    const historical = widths.slice(-100).map((w) => w.value).sort((a, b) => a - b);
    const percentile = (historical.findIndex((w) => w >= currentWidth) / historical.length) * 100;
    const squeeze = percentile < 20;
    readings.push({
      key: "bb-width",
      label: "Bollinger bandwidth percentile",
      display: `${percentile.toFixed(0)}th`,
      raw: percentile,
      direction: "neutral",
      score: squeeze ? 15 : percentile > 85 ? -15 : 0,
      weight: 1.4,
      conclusion: squeeze
        ? `Bandwidth sits in the ${percentile.toFixed(0)}th percentile of the last 100 sessions — a volatility squeeze. Compression this tight is almost always followed by expansion; the setup is to prepare for a breakout, not to predict its direction.`
        : percentile > 85
          ? `Bandwidth is in the ${percentile.toFixed(0)}th percentile, meaning volatility is already stretched. Entering after expansion has happened is usually the worst timing — these phases tend to be followed by contraction.`
          : `Bandwidth is mid-range at the ${percentile.toFixed(0)}th percentile. Volatility is normal, offering no particular edge from compression or expansion.`,
    });
  }

  // --- Annualised historical volatility -----------------------------------
  const hv = historicalVolatility(data, 20);
  if (hv !== null) {
    readings.push({
      key: "hist-vol",
      label: "Annualised volatility (20d)",
      display: `${hv.toFixed(1)}%`,
      raw: hv,
      direction: "neutral",
      score: hv < 20 ? 15 : hv < 40 ? 0 : -25,
      weight: 1,
      conclusion: `Annualised volatility of ${hv.toFixed(1)}% ${hv < 20 ? "is low, implying steadier trends and easier position management" : hv < 40 ? "is typical for a liquid equity" : "is high — expect sharp drawdowns even if the eventual direction is correct, and size accordingly"}.`,
    });
  }

  const score = weightedScore(readings);
  return {
    key: "volatility",
    label: "Volatility",
    description: "How much movement to expect, and how to size for it",
    score,
    direction: directionOf(score),
    readings,
    summary: summariseGroup("volatility", score, readings),
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function weightedScore(readings: SignalReading[]): number {
  if (readings.length === 0) return 0;
  let total = 0;
  let weights = 0;
  for (const r of readings) {
    total += r.score * r.weight;
    weights += r.weight;
  }
  return weights === 0 ? 0 : clamp(total / weights);
}

function summariseGroup(key: string, score: number, readings: SignalReading[]): string {
  const bullish = readings.filter((r) => r.direction === "bullish").length;
  const bearish = readings.filter((r) => r.direction === "bearish").length;
  const tone = score >= 40 ? "strongly positive" : score >= 15 ? "mildly positive" : score <= -40 ? "strongly negative" : score <= -15 ? "mildly negative" : "neutral";

  const labels: Record<string, string> = {
    trend: "Trend signals are",
    momentum: "Momentum signals are",
    structure: "Structural signals are",
    volume: "Volume signals are",
    volatility: "Volatility conditions are",
  };

  return `${labels[key] ?? "Signals are"} ${tone} (${bullish} bullish, ${bearish} bearish out of ${readings.length} readings).`;
}

function toVerdict(score: number, confidence: number): Verdict {
  // Low confidence pulls the verdict toward neutral — we should not issue a
  // strong call off a thin or contradictory evidence base.
  const adjusted = score * (0.5 + confidence / 200);
  if (adjusted >= 45) return "strong-buy";
  if (adjusted >= 18) return "accumulate";
  if (adjusted > -18) return "hold";
  if (adjusted > -45) return "reduce";
  return "avoid";
}

/**
 * Confidence reflects agreement between groups, not the strength of the call.
 * Five groups all pointing the same way is high confidence; a 3-2 split is not.
 */
function computeConfidence(groups: SignalGroup[]): number {
  if (groups.length === 0) return 0;
  const scores = groups.map((g) => g.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const sd = Math.sqrt(variance);
  // sd of 0 -> perfect agreement -> 100. sd of 60+ -> total disagreement -> ~20.
  const agreement = Math.max(0, 100 - sd * 1.4);
  // Weight also by how decisive the average is.
  const decisiveness = Math.min(Math.abs(mean) * 1.2, 100);
  return Math.round(clamp(agreement * 0.65 + decisiveness * 0.35, 0, 100));
}

/**
 * Horizon-specific plan geometry.
 *
 * `minTotalUpside` is the payoff below which a plan is flagged as not worth
 * the horizon. A positional trade is an allocation of capital for six to
 * twelve months; if the whole ladder only pays 9%, the correct output is to
 * say so rather than to dress it up as a setup.
 */
const PLAN_GEOMETRY: Record<Horizon, {
  atrStopMultiple: number;
  minStopAtr: number;
  laddderR: [number, number, number];
  minTotalUpside: number;
  pivotLookback: number;
  maxPullbackPercent: number;
}> = {
  swing: {
    atrStopMultiple: 2,
    // A stop closer than this is inside the noise and will be taken out by a
    // single ordinary session, which turns a good thesis into a loss.
    minStopAtr: 1.1,
    laddderR: [1, 2, 3],
    minTotalUpside: 6,
    pivotLookback: 5,
    maxPullbackPercent: 12,
  },
  positional: {
    atrStopMultiple: 3,
    minStopAtr: 1.8,
    // A positional hold is only worth the capital lockup if the tail of the
    // ladder is large, so the upper rungs are set far wider than the swing
    // ladder rather than at the same multiples.
    laddderR: [1.2, 3, 6],
    minTotalUpside: 25,
    pivotLookback: 8,
    maxPullbackPercent: 20,
  },
};

/**
 * Build the trade plan.
 *
 * Two rules govern everything below:
 *
 *  1. **The first target must pay at least as much as the trade risks.** The
 *     previous version computed an ATR target ladder, then overwrote target 1
 *     with the nearest resistance and recomputed its R multiple from whatever
 *     that happened to be. When resistance sat close overhead — a very common
 *     situation, and exactly the one where a plan matters most — that produced
 *     ratios like 1:0.2 alongside a positive verdict. The ladder is now built
 *     from the floor ratio outward and the floor is never crossed.
 *
 *  2. **When the structure cannot support the floor ratio from today's price,
 *     say so and name the level that would.** "Wait for a pullback to 4,780"
 *     is actionable. "1:0.2" is not.
 */
function buildTradePlan(data: Candle[], horizon: Horizon): TradePlan | null {
  const price = data[data.length - 1].close;
  const atrValue = latest(atr(data, 14));
  if (atrValue === null || atrValue <= 0 || price <= 0) return null;

  const geo = PLAN_GEOMETRY[horizon];
  const levels = supportResistance(data, price, 1.5, geo.pivotLookback);

  const nearestSupport = levels.supports.find((l) => l.price < price);
  const nearestResistance = levels.resistances.find((l) => l.price > price);

  // --- Stop placement ------------------------------------------------------
  // Anchored on structure where structure exists. A stop just under the shelf
  // price has actually respected is both tighter and more meaningful than a
  // blind ATR multiple, and a tighter stop is most of what makes 1:1 reachable
  // without inventing an optimistic target.
  const atrStop = price - atrValue * geo.atrStopMultiple;
  const structuralStop = nearestSupport ? nearestSupport.price - atrValue * 0.35 : null;

  // Never tighter than the noise floor, never wider than the ATR stop.
  const noiseFloor = price - atrValue * geo.minStopAtr;
  let stopLoss = atrStop;
  let stopBasis = `${geo.atrStopMultiple}× ATR below price`;

  if (structuralStop !== null && structuralStop > atrStop && structuralStop < noiseFloor) {
    stopLoss = structuralStop;
    stopBasis = `just under support at ${nearestSupport!.price.toFixed(2)} (${nearestSupport!.touches} touches)`;
  }

  const risk = price - stopLoss;
  if (risk <= 0) return null;

  // --- Where the upside actually ends --------------------------------------
  // Exit into resistance, not at it: the last stretch to a level with a
  // history of rejections is the part least likely to be captured.
  const ceiling = nearestResistance
    ? Math.max(price, nearestResistance.price - atrValue * 0.15)
    : null;
  const rrToCeiling = ceiling !== null ? (ceiling - price) / risk : Infinity;

  const accountSize = 100_000;
  const riskPercent = 1;
  const common = {
    atr: atrValue,
    atrPercent: (atrValue / price) * 100,
    expectedHold: horizon === "swing" ? ("1–6 weeks" as const) : ("3–12 months" as const),
  };

  // --- Case 1: the nearest ceiling is too close to pay for the risk --------
  if (ceiling !== null && rrToCeiling < MIN_FIRST_TARGET_RR) {
    return buildWaitPlan({
      data,
      price,
      atrValue,
      geo,
      horizon,
      ceiling,
      rrToCeiling,
      blockingResistance: nearestResistance!.price,
      nearestSupport: nearestSupport?.price ?? null,
      accountSize,
      riskPercent,
      common,
    });
  }

  // --- Case 2: there is room. Build the ladder from the floor ratio out ----
  const targets: TradeTarget[] = [];

  // Target 1 is the structural ceiling when that clears the floor ratio,
  // otherwise the floor ratio itself. Because of the guard above, the ceiling
  // always clears it here — the Math.max is belt and braces against a level
  // landing exactly on the boundary.
  const firstR = ceiling !== null ? Math.max(geo.laddderR[0], rrToCeiling) : geo.laddderR[0];
  const firstPrice = ceiling !== null && rrToCeiling >= geo.laddderR[0] ? ceiling : price + risk * geo.laddderR[0];

  targets.push({
    label: "Target 1",
    price: firstPrice,
    rMultiple: (firstPrice - price) / risk,
    gainPercent: ((firstPrice - price) / price) * 100,
    basis:
      ceiling !== null && rrToCeiling >= geo.laddderR[0]
        ? `resistance at ${nearestResistance!.price.toFixed(2)}, exited just below it`
        : `${firstR.toFixed(1)}× the risk taken`,
  });

  // Upper rungs: the next real levels overhead where they exist, otherwise R
  // projections. Each rung must clear the one below it, so a cluster of tight
  // levels cannot produce a flat or inverted ladder.
  const higherLevels = levels.resistances
    .filter((l) => l.price - atrValue * 0.15 > targets[0].price)
    .sort((a, b) => a.price - b.price);

  for (let i = 1; i < geo.laddderR.length; i += 1) {
    const projected = price + risk * geo.laddderR[i];
    const level = higherLevels[i - 1];
    const useLevel = level !== undefined && level.price - atrValue * 0.15 > targets[i - 1].price * 1.005;
    const candidate = useLevel ? level.price - atrValue * 0.15 : projected;
    const targetPrice = Math.max(candidate, targets[i - 1].price * 1.01);

    targets.push({
      label: `Target ${i + 1}`,
      price: targetPrice,
      rMultiple: (targetPrice - price) / risk,
      gainPercent: ((targetPrice - price) / price) * 100,
      basis: useLevel
        ? `resistance at ${level.price.toFixed(2)}`
        : `${((targetPrice - price) / risk).toFixed(1)}× the risk taken`,
    });
  }

  const shares = Math.floor((accountSize * (riskPercent / 100)) / risk);
  const totalUpsidePercent = targets[targets.length - 1].gainPercent;

  return {
    status: "actionable",
    entryLow: price - atrValue * 0.5,
    entryHigh: price + atrValue * 0.3,
    stopLoss,
    stopPercent: (risk / price) * 100,
    stopBasis,
    targets,
    riskRewardRatio: targets[0].rMultiple,
    totalUpsidePercent,
    wait: null,
    rewardNote: rewardNoteFor(horizon, geo, totalUpsidePercent),
    positionSizeExample: { accountSize, riskPercent, shares, capitalRequired: shares * price },
    ...common,
  };
}

/**
 * Flag a ladder that is coherent but too small to justify the holding period.
 *
 * Passing this test is not the same as the trade being good. It only means the
 * payoff is large enough to be worth the horizon's opportunity cost.
 */
function rewardNoteFor(
  horizon: Horizon,
  geo: (typeof PLAN_GEOMETRY)[Horizon],
  totalUpsidePercent: number,
): string | null {
  if (totalUpsidePercent >= geo.minTotalUpside) return null;

  return horizon === "positional"
    ? `The full ladder only reaches ${totalUpsidePercent.toFixed(1)}% upside. For a three-to-twelve-month hold that is a poor use of the capital even though the ratio is sound — the levels above are close together, which is what a stock entering a range looks like. A swing-horizon read on the same chart is the more honest expression.`
    : `The full ladder only reaches ${totalUpsidePercent.toFixed(1)}% upside. The ratio is sound but the absolute move is small, so costs and slippage eat a meaningful share of it.`;
}

/**
 * The plan for a stock whose upside is capped before it pays for its risk.
 *
 * Solved rather than guessed. For an entry `E`, stop `S` and target `T`, the
 * ratio is `(T − E) / (E − S)`. Setting that equal to the floor ratio `k` and
 * solving for `E` gives the exact price at which the trade becomes valid:
 *
 *     E = (T + k·S) / (1 + k)
 *
 * That level is published as a limit entry. The alternative branch — the
 * resistance breaking instead of price pulling back — is published as a
 * trigger, because a trader watching only for the pullback misses the case
 * where the ceiling simply stops being a ceiling.
 */
function buildWaitPlan(args: {
  data: Candle[];
  price: number;
  atrValue: number;
  geo: (typeof PLAN_GEOMETRY)[Horizon];
  horizon: Horizon;
  ceiling: number;
  rrToCeiling: number;
  blockingResistance: number;
  nearestSupport: number | null;
  accountSize: number;
  riskPercent: number;
  common: { atr: number; atrPercent: number; expectedHold: string };
}): TradePlan | null {
  const {
    price, atrValue, geo, horizon, ceiling, rrToCeiling,
    blockingResistance, nearestSupport, accountSize, riskPercent, common,
  } = args;

  const k = MIN_FIRST_TARGET_RR;

  // The stop for a pullback entry sits under the support being bought, or a
  // clean ATR multiple below the entry when there is no support to lean on.
  const plannedStop =
    nearestSupport !== null
      ? nearestSupport - atrValue * 0.35
      : price - atrValue * (geo.atrStopMultiple + 1);

  const idealEntry = (ceiling + k * plannedStop) / (1 + k);
  const plannedRisk = idealEntry - plannedStop;
  const pullbackPercent = ((price - idealEntry) / price) * 100;

  // A trigger above the level, not at it: the first print through resistance
  // is frequently a wick that closes back under.
  const breakoutTrigger = blockingResistance + atrValue * 0.35;

  const shortfall = `Immediate resistance at ${blockingResistance.toFixed(2)} is only ${(((blockingResistance - price) / price) * 100).toFixed(1)}% above price, so entering here risks ${((price - plannedStop) / price * 100).toFixed(1)}% to make ${(((ceiling - price) / price) * 100).toFixed(1)}% — about 1:${rrToCeiling.toFixed(2)} before costs.`;

  const steps: string[] = [];
  const pullbackViable =
    plannedRisk > 0 &&
    idealEntry < price &&
    idealEntry > plannedStop &&
    pullbackPercent <= geo.maxPullbackPercent;

  if (pullbackViable) {
    steps.push(
      `Work a limit at ${idealEntry.toFixed(2)} — ${pullbackPercent.toFixed(1)}% below the current price. At that entry, with the stop at ${plannedStop.toFixed(2)}, the same ${blockingResistance.toFixed(2)} ceiling pays 1:${k.toFixed(1)} instead of 1:${rrToCeiling.toFixed(2)}.`,
    );
  } else {
    steps.push(
      `A pullback deep enough to fix the ratio would be ${pullbackPercent.toFixed(1)}% — far enough that it would damage the setup it is meant to improve. Treat the ceiling as the decision point instead.`,
    );
  }

  steps.push(
    `Alternatively, let it break: a close above ${breakoutTrigger.toFixed(2)} removes the cap entirely, and the plan can then be rebuilt against the next level overhead rather than this one.`,
  );
  steps.push(
    `Do neither in between. Buying into a ceiling with the stop where it has to be is the single most reliable way to take a full loss on a chart that was right about direction.`,
  );

  if (!pullbackViable) {
    // Nothing coherent to publish: no entry that satisfies the floor ratio and
    // no sensible pullback. The UI renders this as "no plan", which is correct.
    return {
      status: "wait",
      entryLow: price,
      entryHigh: price,
      stopLoss: plannedStop,
      stopPercent: ((price - plannedStop) / price) * 100,
      stopBasis:
        nearestSupport !== null
          ? `just under support at ${nearestSupport.toFixed(2)}`
          : `${geo.atrStopMultiple + 1}× ATR below price`,
      targets: [],
      riskRewardRatio: k,
      totalUpsidePercent: 0,
      wait: {
        reason: shortfall,
        blockingResistance,
        rrIfEnteredNow: rrToCeiling,
        idealEntry,
        breakoutTrigger,
        steps,
      },
      rewardNote: null,
      positionSizeExample: { accountSize, riskPercent, shares: 0, capitalRequired: 0 },
      ...common,
    };
  }

  // Ladder measured from the planned entry, not from today's price.
  const laddderFromEntry: TradeTarget[] = [
    {
      label: "Target 1",
      price: ceiling,
      rMultiple: (ceiling - idealEntry) / plannedRisk,
      gainPercent: ((ceiling - idealEntry) / idealEntry) * 100,
      basis: `resistance at ${blockingResistance.toFixed(2)}, exited just below it`,
    },
  ];
  for (let i = 1; i < geo.laddderR.length; i += 1) {
    const targetPrice = idealEntry + plannedRisk * geo.laddderR[i];
    if (targetPrice <= laddderFromEntry[i - 1].price) continue;
    laddderFromEntry.push({
      label: `Target ${i + 1}`,
      price: targetPrice,
      rMultiple: geo.laddderR[i],
      gainPercent: ((targetPrice - idealEntry) / idealEntry) * 100,
      basis: `${geo.laddderR[i].toFixed(1)}× the risk taken, valid only once ${blockingResistance.toFixed(2)} is through`,
    });
  }

  const shares = Math.floor((accountSize * (riskPercent / 100)) / plannedRisk);
  const totalUpsidePercent = laddderFromEntry[laddderFromEntry.length - 1].gainPercent;

  return {
    status: "wait",
    entryLow: idealEntry - atrValue * 0.25,
    entryHigh: idealEntry + atrValue * 0.15,
    stopLoss: plannedStop,
    stopPercent: (plannedRisk / idealEntry) * 100,
    stopBasis:
      nearestSupport !== null
        ? `just under support at ${nearestSupport.toFixed(2)}`
        : `${geo.atrStopMultiple + 1}× ATR below the planned entry`,
    targets: laddderFromEntry,
    riskRewardRatio: laddderFromEntry[0].rMultiple,
    totalUpsidePercent,
    wait: {
      reason: shortfall,
      blockingResistance,
      rrIfEnteredNow: rrToCeiling,
      idealEntry,
      breakoutTrigger,
      steps,
    },
    rewardNote: rewardNoteFor(horizon, geo, totalUpsidePercent),
    positionSizeExample: { accountSize, riskPercent, shares, capitalRequired: shares * idealEntry },
    ...common,
  };
}

function buildNarrative(
  symbol: string,
  groups: SignalGroup[],
  compositeScore: number,
  verdict: Verdict,
  confidence: number,
  horizon: Horizon,
  trendRegime: string,
  plan: TradePlan | null,
): { narrative: string; narrativePoints: NarrativePoint[]; keyPoints: string[]; risks: string[] } {
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const trend = byKey.get("trend");
  const momentum = byKey.get("momentum");
  const structure = byKey.get("structure");
  const volume = byKey.get("volume");
  const volatility = byKey.get("volatility");

  const horizonLabel = horizon === "swing" ? "swing (1–6 weeks)" : "positional (3–12 months)";

  const verdictSentence: Record<Verdict, string> = {
    "strong-buy": `The evidence lines up well for a ${horizonLabel} long.`,
    accumulate: `There is a constructive case here for a ${horizonLabel} position, though not a decisive one.`,
    hold: `There is no clear edge on a ${horizonLabel} view right now.`,
    reduce: `The technical picture argues against new ${horizonLabel} longs.`,
    avoid: `The technical evidence is clearly negative for a ${horizonLabel} view.`,
  };

  /**
   * The summary is built as discrete points rather than one paragraph.
   *
   * The paragraph version ran to roughly 900 characters of unbroken prose,
   * which is longer than anyone reads on a screen they are scanning for a
   * price. Each point below answers exactly one question, and the labels are
   * what a reader jumps between.
   */
  const points: NarrativePoint[] = [];

  const overallTone: NarrativePoint["tone"] =
    compositeScore >= 20 ? "bullish" : compositeScore <= -20 ? "bearish" : "neutral";

  points.push({
    label: "The call",
    text: `${verdictSentence[verdict]} Composite score ${compositeScore > 0 ? "+" : ""}${compositeScore.toFixed(0)} out of 100, at ${confidence}% signal agreement, from ${groups.reduce((a, g) => a + g.readings.length, 0)} readings.`,
    tone: overallTone,
  });

  points.push({
    label: "Trend",
    text: trend
      ? `${capitalise(trendRegime)}. ${firstSentence(trend.readings[0]?.conclusion ?? trend.summary)}`
      : capitalise(trendRegime),
    tone: toneOf(trend?.score ?? 0),
  });

  if (momentum) {
    const strongest = dominant(momentum);
    if (strongest) {
      points.push({
        label: "Momentum",
        text: `${strongest.label} at ${strongest.display}. ${firstSentence(strongest.conclusion)}`,
        tone: toneOf(momentum.score),
      });
    }
  }

  if (structure) {
    const strongest = dominant(structure);
    if (strongest) {
      points.push({
        label: "Location",
        text: firstSentence(strongest.conclusion),
        tone: toneOf(structure.score),
      });
    }
  }

  if (volume) {
    const strongest = dominant(volume);
    if (strongest) {
      points.push({
        label: "Participation",
        text: `${strongest.label} at ${strongest.display}. ${firstSentence(strongest.conclusion)}`,
        tone: toneOf(volume.score),
      });
    }
  }

  if (volatility) {
    points.push({
      label: "Volatility",
      text: `ATR is ${plan ? `${plan.atrPercent.toFixed(2)}% of price. ` : ""}${firstSentence(dominant(volatility)?.conclusion ?? volatility.summary)}`,
      tone: toneOf(volatility.score),
    });
  }

  // The actionable line reads differently depending on whether the plan is
  // takeable now. Saying "entry around X" for a setup the engine has just
  // declined to endorse is the contradiction this replaces.
  if (plan && plan.status === "actionable") {
    points.push({
      label: "The plan",
      text: `Entry ${plan.entryLow.toFixed(2)}–${plan.entryHigh.toFixed(2)}, stop ${plan.stopLoss.toFixed(2)} (${plan.stopPercent.toFixed(1)}% away, ${plan.stopBasis}), first target ${plan.targets[0].price.toFixed(2)} at 1:${plan.riskRewardRatio.toFixed(1)}. On ₹1,00,000 risking 1%, about ${plan.positionSizeExample.shares} shares.`,
      tone: "neutral",
    });
  } else if (plan && plan.wait) {
    points.push({
      label: "Not yet",
      text: `${plan.wait.reason} ${plan.targets.length > 0 ? `A limit at ${plan.wait.idealEntry.toFixed(2)} restores 1:${plan.riskRewardRatio.toFixed(1)}; a close above ${plan.wait.breakoutTrigger.toFixed(2)} removes the cap.` : `A close above ${plan.wait.breakoutTrigger.toFixed(2)} is the level that changes it.`}`,
      tone: "neutral",
    });
  }

  if (plan?.rewardNote) {
    points.push({ label: "Payoff", text: plan.rewardNote, tone: "neutral" });
  }

  // The prose form is kept for the API and for page metadata, where a single
  // string is what the consumer wants.
  const parts = points.map((p) => p.text);

  const keyPoints: string[] = [];
  for (const g of groups) {
    const top = [...g.readings].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
    if (top) {
      keyPoints.push(`${g.label}: ${top.label} at ${top.display} — ${top.direction}.`);
    }
  }

  const risks: string[] = [];
  const disagreeing = groups.filter((g) => Math.sign(g.score) !== Math.sign(compositeScore) && Math.abs(g.score) > 15);
  for (const g of disagreeing) {
    risks.push(`${g.label} disagrees with the overall read (score ${g.score.toFixed(0)}). ${g.summary}`);
  }
  if (confidence < 45) {
    risks.push(
      `Signal agreement is only ${confidence}%, meaning the categories are pulling in different directions. Low-agreement setups have materially worse follow-through — a smaller position or simply waiting is often the better expression.`,
    );
  }
  if (volatility && volatility.score < -20) {
    risks.push("Volatility conditions are unfavourable, so stops must be wide and size correspondingly small.");
  }
  if (risks.length === 0) {
    risks.push(
      "No major internal contradictions in the current readings. The main risk is external: earnings, sector rotation or broad market shocks are not captured by price-based indicators.",
    );
  }

  return { narrative: parts.join(" "), narrativePoints: points, keyPoints, risks };
}

/**
 * The single most significant reading in a group.
 *
 * Significance is absolute score, not sign: a strongly bearish reading inside
 * a mildly bullish group is the thing the reader most needs to see.
 */
function dominant(group: SignalGroup): SignalReading | undefined {
  return [...group.readings].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
}

function toneOf(score: number): NarrativePoint["tone"] {
  return score >= 20 ? "bullish" : score <= -20 ? "bearish" : "neutral";
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Trim a multi-sentence conclusion to its first sentence.
 *
 * Indicator conclusions are written at length for the expandable detail cards,
 * where the reader has asked for depth. In the summary they have not, and
 * three of them side by side is how the wall of text formed in the first
 * place. Decimals are protected so "1.5% of price" does not split.
 */
function firstSentence(value: string): string {
  if (!value) return "";
  const match = value.match(/^.*?[.!?](?=\s+[A-Z(]|$)/s);
  const first = (match?.[0] ?? value).trim();
  return first.length > 0 ? first : value.trim();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function analyzeTechnical(
  symbol: string,
  dailyCandles: Candle[],
  horizon: Horizon = "swing",
  timeframe: Timeframe = "daily",
): TechnicalAnalysis | null {
  if (dailyCandles.length < 60) return null;

  // Positional analysis reads weekly candles; swing reads daily. This single
  // choice is what makes the two horizons genuinely different rather than
  // cosmetically different.
  const data =
    timeframe === "weekly"
      ? resample(dailyCandles, "weekly")
      : timeframe === "monthly"
        ? resample(dailyCandles, "monthly")
        : dailyCandles;

  if (data.length < 50) return null;

  const price = data[data.length - 1].close;

  const groups: SignalGroup[] = [
    buildTrendGroup(data, horizon),
    buildMomentumGroup(data, horizon),
    buildStructureGroup(data, horizon),
    buildVolumeGroup(data),
    buildVolatilityGroup(data),
  ].filter((g) => g.readings.length > 0);

  const weights = GROUP_WEIGHTS[horizon];
  let composite = 0;
  let weightSum = 0;
  for (const g of groups) {
    const w = weights[g.key] ?? 0.1;
    composite += g.score * w;
    weightSum += w;
  }
  const compositeScore = weightSum === 0 ? 0 : clamp(composite / weightSum);
  const confidence = computeConfidence(groups);
  const verdict = toVerdict(compositeScore, confidence);

  // Trend regime classification
  const adxValue = latest(adx(data, 14).adx) ?? 0;
  const ema50 = latest(ema(data, 50));
  const ema200 = latest(ema(data, 200));
  let regime: "uptrend" | "downtrend" | "range";
  if (adxValue < 20) regime = "range";
  else if (ema50 !== null && ema200 !== null) regime = ema50 > ema200 ? "uptrend" : "downtrend";
  else regime = price > (ema50 ?? price) ? "uptrend" : "downtrend";

  const regimeLabel =
    regime === "range"
      ? `a non-trending range (ADX ${adxValue.toFixed(1)})`
      : `an established ${regime} (ADX ${adxValue.toFixed(1)})`;

  const window = data.slice(-252);
  const high52 = Math.max(...window.map((c) => c.high));
  const low52 = Math.min(...window.map((c) => c.low));
  const levels = supportResistance(data, price, 1.5, horizon === "swing" ? 5 : 8);

  const plan = verdict === "avoid" || verdict === "reduce" ? null : buildTradePlan(data, horizon);

  const { narrative, narrativePoints, keyPoints, risks } = buildNarrative(
    symbol,
    groups,
    compositeScore,
    verdict,
    confidence,
    horizon,
    regimeLabel,
    plan,
  );

  return {
    symbol,
    timeframe,
    horizon,
    asOf: new Date(data[data.length - 1].time).toISOString(),
    price,
    compositeScore,
    verdict,
    confidence,
    groups,
    trend: {
      regime,
      label: regimeLabel,
      strength: Math.round(Math.min(adxValue / 50, 1) * 100),
      description:
        regime === "range"
          ? "Price is rotating within a range rather than trending. Breakout strategies underperform badly in this regime."
          : `Price is in a sustained ${regime}. Trend-following approaches have a genuine edge while this persists.`,
    },
    structure: {
      fiftyTwoWeekPosition: high52 === low52 ? 50 : ((price - low52) / (high52 - low52)) * 100,
      distanceFromHigh: ((price - high52) / high52) * 100,
      distanceFromLow: ((price - low52) / low52) * 100,
      supports: levels.supports,
      resistances: levels.resistances,
    },
    plan,
    narrative,
    narrativePoints,
    keyPoints,
    risks,
    narrativeSource: "engine",
  };
}

export { fmt };
