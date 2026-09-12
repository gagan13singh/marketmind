import type {
  FundamentalAnalysis,
  FundamentalSnapshot,
  NarrativePoint,
  SignalDirection,
  SignalGroup,
  SignalReading,
  Verdict,
} from "@/types";

/**
 * Fundamental analysis engine.
 *
 * Scoped for POSITIONAL decisions — the questions that matter when holding a
 * business for months or years: is it growing, does it earn a real return on
 * capital, can it survive its debt, does reported profit turn into cash, is
 * the price sane, and is the owner group committed.
 *
 * Every metric is scored -100..+100 and grouped into six themes. Missing data
 * is dropped rather than guessed — an absent reading lowers confidence rather
 * than silently biasing the result.
 */

const clamp = (v: number, lo = -100, hi = 100): number => Math.max(lo, Math.min(hi, v));

function directionOf(score: number): SignalDirection {
  if (score >= 20) return "bullish";
  if (score <= -20) return "bearish";
  return "neutral";
}

function pct(v: number | null, digits = 1): string {
  return v === null || !Number.isFinite(v) ? "—" : `${v >= 0 ? "" : ""}${v.toFixed(digits)}%`;
}

function ratio(v: number | null, digits = 2): string {
  return v === null || !Number.isFinite(v) ? "—" : v.toFixed(digits);
}

/**
 * Map a value onto a score using a piecewise-linear scale.
 * `points` is an ascending list of [value, score] anchors.
 */
function scaleScore(value: number, points: [number, number][]): number {
  if (points.length === 0) return 0;
  if (value <= points[0][0]) return points[0][1];
  if (value >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (value >= x0 && value <= x1) {
      const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 0;
}

const weightedScore = (readings: SignalReading[]): number => {
  if (readings.length === 0) return 0;
  let total = 0;
  let weights = 0;
  for (const r of readings) {
    total += r.score * r.weight;
    weights += r.weight;
  }
  return weights === 0 ? 0 : clamp(total / weights);
};

// ---------------------------------------------------------------------------
// Growth
// ---------------------------------------------------------------------------

function buildGrowthGroup(f: FundamentalSnapshot): SignalGroup {
  const readings: SignalReading[] = [];
  const g = f.growth;

  if (g.revenueCagr3y !== null) {
    const score = scaleScore(g.revenueCagr3y, [
      [-20, -95], [-5, -60], [0, -25], [8, 20], [15, 60], [25, 90], [45, 100],
    ]);
    readings.push({
      key: "revenue-cagr-3y",
      label: "Revenue CAGR (3Y)",
      display: pct(g.revenueCagr3y),
      raw: g.revenueCagr3y,
      direction: directionOf(score),
      score,
      weight: 3,
      conclusion:
        g.revenueCagr3y > 20
          ? `Revenue has compounded at ${g.revenueCagr3y.toFixed(1)}% a year over three years. Growth at this rate usually reflects genuine share gain or category expansion, and it is the strongest single argument for paying a premium multiple.`
          : g.revenueCagr3y > 10
            ? `Revenue compounding at ${g.revenueCagr3y.toFixed(1)}% is solid, comfortably ahead of nominal GDP. Sustainable growth of this kind is what positional holdings are built on.`
            : g.revenueCagr3y > 0
              ? `Revenue growth of ${g.revenueCagr3y.toFixed(1)}% is positive but slow — roughly inflation-level. The investment case has to rest on margins, capital returns or re-rating rather than on growth.`
              : `Revenue has contracted at ${Math.abs(g.revenueCagr3y).toFixed(1)}% a year over three years. Shrinking top line is the hardest problem for a business to fix, and it undermines almost any valuation argument.`,
    });
  }

  if (g.profitCagr3y !== null) {
    const score = scaleScore(g.profitCagr3y, [
      [-30, -95], [-10, -65], [0, -25], [10, 25], [20, 65], [35, 95], [60, 100],
    ]);
    readings.push({
      key: "profit-cagr-3y",
      label: "Net profit CAGR (3Y)",
      display: pct(g.profitCagr3y),
      raw: g.profitCagr3y,
      direction: directionOf(score),
      score,
      weight: 3,
      conclusion:
        g.revenueCagr3y !== null && g.profitCagr3y > g.revenueCagr3y + 3
          ? `Profit has grown at ${g.profitCagr3y.toFixed(1)}% versus revenue at ${g.revenueCagr3y.toFixed(1)}% — operating leverage is working. Profit outpacing sales means each additional rupee of revenue is dropping through at a higher rate, which is the most valuable form of growth.`
          : g.revenueCagr3y !== null && g.profitCagr3y < g.revenueCagr3y - 3
            ? `Profit growth of ${g.profitCagr3y.toFixed(1)}% is lagging revenue growth of ${g.revenueCagr3y.toFixed(1)}%. Margins are compressing — the company is buying growth rather than earning it, which is a meaningfully lower-quality outcome.`
            : `Profit has compounded at ${g.profitCagr3y.toFixed(1)}% a year, broadly tracking revenue. Margins are stable, so growth is coming through cleanly to the bottom line.`,
    });
  }

  if (g.revenueYoy !== null) {
    const score = scaleScore(g.revenueYoy, [[-25, -90], [-5, -50], [0, -15], [10, 35], [20, 70], [35, 95]]);
    readings.push({
      key: "revenue-yoy",
      label: "Revenue growth (YoY)",
      display: pct(g.revenueYoy),
      raw: g.revenueYoy,
      direction: directionOf(score),
      score,
      weight: 2,
      conclusion:
        g.revenueCagr3y !== null && g.revenueYoy > g.revenueCagr3y + 5
          ? `The latest year grew ${g.revenueYoy.toFixed(1)}%, ahead of the 3-year trend of ${g.revenueCagr3y.toFixed(1)}%. Growth is accelerating, which is the single most reliable driver of re-rating.`
          : g.revenueCagr3y !== null && g.revenueYoy < g.revenueCagr3y - 5
            ? `The latest year grew only ${g.revenueYoy.toFixed(1)}% against a 3-year trend of ${g.revenueCagr3y.toFixed(1)}%. Decelerating growth typically leads to multiple compression even when absolute numbers still look healthy.`
            : `Latest-year revenue growth of ${g.revenueYoy.toFixed(1)}% is consistent with the medium-term trend. Predictable, which is exactly what a positional holding wants.`,
    });
  }

  if (g.profitYoy !== null) {
    const score = scaleScore(g.profitYoy, [[-40, -95], [-10, -55], [0, -15], [15, 45], [30, 80], [50, 100]]);
    readings.push({
      key: "profit-yoy",
      label: "Profit growth (YoY)",
      display: pct(g.profitYoy),
      raw: g.profitYoy,
      direction: directionOf(score),
      score,
      weight: 2,
      conclusion: `Latest-year profit ${g.profitYoy >= 0 ? "grew" : "fell"} ${Math.abs(g.profitYoy).toFixed(1)}%. ${Math.abs(g.profitYoy) > 40 ? "Swings this large usually contain one-off items — worth checking whether the change is operational or accounting before extrapolating." : "That is within the range of normal operating variation."}`,
    });
  }

  // Consistency: a business that grows every year is worth more than one that
  // averages the same rate with wild swings.
  const revenues = f.annual.map((a) => a.revenue).filter((r): r is number => r !== null);
  if (revenues.length >= 4) {
    let upYears = 0;
    for (let i = 1; i < revenues.length; i += 1) if (revenues[i] > revenues[i - 1]) upYears += 1;
    const consistency = (upYears / (revenues.length - 1)) * 100;
    const score = scaleScore(consistency, [[0, -80], [50, -10], [75, 45], [100, 90]]);
    readings.push({
      key: "growth-consistency",
      label: "Growth consistency",
      display: `${upYears}/${revenues.length - 1} yrs up`,
      raw: consistency,
      direction: directionOf(score),
      score,
      weight: 1.8,
      conclusion:
        consistency === 100
          ? `Revenue rose in every one of the last ${revenues.length - 1} years. Uninterrupted growth suggests structural demand rather than cyclical luck, and it justifies a lower risk premium.`
          : consistency >= 60
            ? `Revenue rose in ${upYears} of ${revenues.length - 1} years. Broadly reliable with occasional setbacks — normal for most real businesses.`
            : `Revenue rose in only ${upYears} of ${revenues.length - 1} years. Erratic top line points to a cyclical or structurally challenged business; timing the cycle matters more than the average growth rate here.`,
    });
  }

  const score = weightedScore(readings);
  return {
    key: "growth",
    label: "Growth",
    description: "Is the business getting bigger, and at what pace",
    score,
    direction: directionOf(score),
    readings,
    summary: `Growth profile scores ${score.toFixed(0)}/100 across ${readings.length} measures.`,
  };
}

// ---------------------------------------------------------------------------
// Profitability
// ---------------------------------------------------------------------------

function buildProfitabilityGroup(f: FundamentalSnapshot): SignalGroup {
  const readings: SignalReading[] = [];
  const r = f.ratios;

  if (r.roe !== null) {
    const score = scaleScore(r.roe, [[-10, -95], [0, -60], [8, -20], [15, 40], [22, 80], [35, 100]]);
    readings.push({
      key: "roe",
      label: "Return on equity",
      display: pct(r.roe),
      raw: r.roe,
      direction: directionOf(score),
      score,
      weight: 3,
      conclusion:
        r.roe > 20
          ? `ROE of ${r.roe.toFixed(1)}% means the business generates over 20 paise of profit per rupee of shareholder capital. Sustained returns at this level are the hallmark of a genuine competitive advantage — and the main reason a stock can compound for years.`
          : r.roe > 15
            ? `ROE of ${r.roe.toFixed(1)}% is comfortably above the cost of equity for most Indian businesses. The company is creating value with retained earnings rather than destroying it.`
            : r.roe > 8
              ? `ROE of ${r.roe.toFixed(1)}% is modest. The business earns roughly its cost of capital, meaning reinvested profits add little value — growth here does not automatically create shareholder returns.`
              : `ROE of ${r.roe.toFixed(1)}% is poor. The company is earning less than it costs to fund itself, so every rupee retained rather than paid out is arguably value-destructive.`,
    });
  }

  if (r.roce !== null) {
    const score = scaleScore(r.roce, [[-5, -90], [5, -50], [12, 0], [18, 50], [25, 85], [40, 100]]);
    readings.push({
      key: "roce",
      label: "Return on capital employed",
      display: pct(r.roce),
      raw: r.roce,
      direction: directionOf(score),
      score,
      weight: 3,
      conclusion:
        r.roce > 20
          ? `ROCE of ${r.roce.toFixed(1)}% is excellent. Because ROCE includes debt in the capital base, it cannot be flattered by leverage the way ROE can — this is the cleaner read on whether the underlying business is actually good.`
          : r.roce > 12
            ? `ROCE of ${r.roce.toFixed(1)}% is respectable and likely above the company's cost of capital. Expansion should create value.`
            : `ROCE of ${r.roce.toFixed(1)}% is weak. When returns on capital sit below funding costs, growth actively destroys value — a critical warning for any long-hold thesis.`,
    });
  }

  if (r.netMargin !== null) {
    const score = scaleScore(r.netMargin, [[-10, -90], [0, -50], [5, -10], [10, 35], [18, 75], [30, 100]]);
    readings.push({
      key: "net-margin",
      label: "Net profit margin",
      display: pct(r.netMargin),
      raw: r.netMargin,
      direction: directionOf(score),
      score,
      weight: 2,
      conclusion:
        r.netMargin > 15
          ? `Net margin of ${r.netMargin.toFixed(1)}% is strong, indicating real pricing power and a cost structure that is not at the mercy of input inflation.`
          : r.netMargin > 5
            ? `Net margin of ${r.netMargin.toFixed(1)}% is workable but leaves limited cushion. A modest cost shock or price war compresses profit disproportionately at this level.`
            : `Net margin of ${r.netMargin.toFixed(1)}% is thin. Thin-margin businesses are highly operationally geared — small revenue changes swing profit violently in both directions.`,
    });
  }

  // Margin trajectory matters more than the absolute level.
  const margins = f.annual.map((a) => a.netMargin).filter((m): m is number => m !== null);
  if (margins.length >= 3) {
    const recent = margins[margins.length - 1];
    const older = margins[0];
    const delta = recent - older;
    const score = clamp(delta * 12);
    readings.push({
      key: "margin-trend",
      label: "Margin trajectory",
      display: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp`,
      raw: delta,
      direction: directionOf(score),
      score,
      weight: 2.2,
      conclusion:
        delta > 2
          ? `Net margin has expanded ${delta.toFixed(1)} percentage points over the period, from ${older.toFixed(1)}% to ${recent.toFixed(1)}%. Expanding margins alongside growth is the most powerful combination in equity analysis — profit compounds faster than revenue.`
          : delta < -2
            ? `Net margin has compressed ${Math.abs(delta).toFixed(1)} percentage points, from ${older.toFixed(1)}% to ${recent.toFixed(1)}%. Sustained compression usually signals competitive pressure or loss of pricing power, and it caps how far the stock can re-rate.`
            : `Net margin has been stable around ${recent.toFixed(1)}%, moving just ${Math.abs(delta).toFixed(1)} points. Stability implies a defensible position without dramatic improvement.`,
    });
  }

  if (r.assetTurnover !== null) {
    const score = scaleScore(r.assetTurnover, [[0.2, -50], [0.5, -10], [1, 30], [1.8, 65], [3, 85]]);
    readings.push({
      key: "asset-turnover",
      label: "Asset turnover",
      display: `${ratio(r.assetTurnover)}x`,
      raw: r.assetTurnover,
      direction: directionOf(score),
      score,
      weight: 1.2,
      conclusion: `The company generates ${r.assetTurnover.toFixed(2)} rupees of revenue per rupee of assets. ${r.assetTurnover > 1.5 ? "That is capital-light and efficient — growth needs relatively little incremental investment." : r.assetTurnover > 0.7 ? "A normal capital intensity for a manufacturing or diversified business." : "Capital-heavy: expansion will require significant investment, which constrains free cash flow during growth phases."}`,
    });
  }

  const score = weightedScore(readings);
  return {
    key: "profitability",
    label: "Profitability & returns",
    description: "Quality of earnings and efficiency of capital",
    score,
    direction: directionOf(score),
    readings,
    summary: `Profitability scores ${score.toFixed(0)}/100 across ${readings.length} measures.`,
  };
}

// ---------------------------------------------------------------------------
// Balance sheet
// ---------------------------------------------------------------------------

function buildBalanceSheetGroup(f: FundamentalSnapshot): SignalGroup {
  const readings: SignalReading[] = [];
  const r = f.ratios;

  if (r.debtToEquity !== null) {
    // Lower is better — note the descending score scale.
    const score = scaleScore(r.debtToEquity, [[0, 95], [0.3, 70], [0.7, 25], [1.2, -20], [2, -70], [3.5, -100]]);
    readings.push({
      key: "debt-to-equity",
      label: "Debt to equity",
      display: ratio(r.debtToEquity),
      raw: r.debtToEquity,
      direction: directionOf(score),
      score,
      weight: 3,
      conclusion:
        r.debtToEquity < 0.3
          ? `Debt-to-equity of ${r.debtToEquity.toFixed(2)} is very conservative. A near-debt-free balance sheet is the single best protection against a downturn — this company controls its own fate rather than answering to lenders.`
          : r.debtToEquity < 1
            ? `Debt-to-equity of ${r.debtToEquity.toFixed(2)} is a manageable, mainstream level of leverage. Debt is amplifying returns without threatening solvency.`
            : r.debtToEquity < 2
              ? `Debt-to-equity of ${r.debtToEquity.toFixed(2)} is elevated. Leverage this high magnifies both directions — profits get amplified in good years, but a demand shock or rate rise bites hard.`
              : `Debt-to-equity of ${r.debtToEquity.toFixed(2)} is dangerous for most business models. At this level the equity is effectively a call option on the enterprise, and refinancing risk dominates the investment case.`,
    });
  }

  if (r.currentRatio !== null) {
    const score = scaleScore(r.currentRatio, [[0.5, -90], [1, -35], [1.5, 45], [2.5, 80], [4, 40]]);
    readings.push({
      key: "current-ratio",
      label: "Current ratio",
      display: ratio(r.currentRatio),
      raw: r.currentRatio,
      direction: directionOf(score),
      score,
      weight: 2,
      conclusion:
        r.currentRatio < 1
          ? `Current ratio of ${r.currentRatio.toFixed(2)} means short-term liabilities exceed short-term assets. The company depends on continuous refinancing or operating cash to meet near-term obligations — a genuine liquidity risk.`
          : r.currentRatio < 2
            ? `Current ratio of ${r.currentRatio.toFixed(2)} indicates adequate short-term liquidity. Obligations due within a year are covered.`
            : `Current ratio of ${r.currentRatio.toFixed(2)} is comfortable, arguably conservative. Liquidity risk is minimal, though very high ratios can also indicate capital sitting idle rather than being deployed.`,
    });
  }

  if (r.quickRatio !== null) {
    const score = scaleScore(r.quickRatio, [[0.3, -85], [0.7, -30], [1, 30], [1.8, 70], [3, 55]]);
    readings.push({
      key: "quick-ratio",
      label: "Quick ratio",
      display: ratio(r.quickRatio),
      raw: r.quickRatio,
      direction: directionOf(score),
      score,
      weight: 1.5,
      conclusion: `Quick ratio of ${r.quickRatio.toFixed(2)} strips out inventory, which cannot always be sold quickly. ${r.quickRatio > 1 ? "Even excluding stock, liquid assets cover current liabilities — a genuinely resilient position." : "Excluding inventory, the company cannot cover near-term liabilities from liquid assets, which raises dependence on selling stock at full value."}`,
    });
  }

  // Debt trajectory across reported years.
  const debts = f.balanceSheet.map((b) => b.totalDebt).filter((d): d is number => d !== null);
  const equities = f.balanceSheet.map((b) => b.totalEquity).filter((e): e is number => e !== null);
  if (debts.length >= 3 && equities.length >= 3) {
    const firstDe = debts[0] / (equities[0] || 1);
    const lastDe = debts[debts.length - 1] / (equities[equities.length - 1] || 1);
    const delta = lastDe - firstDe;
    const score = clamp(-delta * 90);
    readings.push({
      key: "debt-trend",
      label: "Leverage trajectory",
      display: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`,
      raw: delta,
      direction: directionOf(score),
      score,
      weight: 2.2,
      conclusion:
        delta < -0.1
          ? `Debt-to-equity has fallen from ${firstDe.toFixed(2)} to ${lastDe.toFixed(2)} over the period. Active deleveraging transfers value from lenders to shareholders and steadily de-risks the equity — a strong positive for long holds.`
          : delta > 0.1
            ? `Debt-to-equity has risen from ${firstDe.toFixed(2)} to ${lastDe.toFixed(2)}. Rising leverage needs a justification: if it funds high-return expansion it is fine, but if it funds losses or working capital it is a warning.`
            : `Leverage has been broadly stable around ${lastDe.toFixed(2)}. The capital structure is not a source of change in either direction.`,
    });
  }

  if (r.interestCoverage !== null) {
    const score = scaleScore(r.interestCoverage, [[0, -100], [1.5, -70], [3, -10], [6, 50], [12, 90]]);
    readings.push({
      key: "interest-coverage",
      label: "Interest coverage",
      display: `${ratio(r.interestCoverage, 1)}x`,
      raw: r.interestCoverage,
      direction: directionOf(score),
      score,
      weight: 2,
      conclusion: `Operating profit covers interest ${r.interestCoverage.toFixed(1)} times. ${r.interestCoverage < 3 ? "Below roughly 3x, a bad year can leave the company unable to service its debt from operations — this is where solvency risk becomes real." : "Comfortable cover; debt servicing is not a constraint on the business."}`,
    });
  }

  const score = weightedScore(readings);
  return {
    key: "balance-sheet",
    label: "Balance sheet",
    description: "Financial resilience and solvency",
    score,
    direction: directionOf(score),
    readings,
    summary: `Balance sheet strength scores ${score.toFixed(0)}/100 across ${readings.length} measures.`,
  };
}

// ---------------------------------------------------------------------------
// Cash flow — the accounting-fraud filter
// ---------------------------------------------------------------------------

function buildCashFlowGroup(f: FundamentalSnapshot): SignalGroup {
  const readings: SignalReading[] = [];

  const recentCf = f.cashFlow[f.cashFlow.length - 1];
  const recentPl = f.annual[f.annual.length - 1];

  if (recentCf?.operatingCashFlow != null && recentPl?.netProfit != null && recentPl.netProfit !== 0) {
    const conversion = recentCf.operatingCashFlow / recentPl.netProfit;
    const score = scaleScore(conversion, [[-1, -100], [0, -85], [0.5, -40], [0.8, 25], [1.1, 80], [2, 90], [4, 40]]);
    readings.push({
      key: "cash-conversion",
      label: "Operating cash / net profit",
      display: `${ratio(conversion)}x`,
      raw: conversion,
      direction: directionOf(score),
      score,
      weight: 3.2,
      conclusion:
        conversion < 0
          ? `The company reported profit but operating cash flow was negative. This is the single most serious red flag in fundamental analysis — accounting profit that produces no cash usually means aggressive revenue recognition or a working-capital blow-up.`
          : conversion < 0.7
            ? `Only ${(conversion * 100).toFixed(0)}% of reported profit converted into operating cash. Persistent under-conversion points to profits being tied up in receivables or inventory rather than banked. Worth investigating before committing capital.`
            : conversion < 1.3
              ? `Operating cash flow is ${conversion.toFixed(2)}x reported profit — healthy conversion. Reported earnings are backed by actual cash, which is the basic test of earnings quality.`
              : `Operating cash flow is ${conversion.toFixed(2)}x reported profit, well above it. Typically reflects heavy non-cash depreciation, which is normal for asset-heavy businesses and is a sign of conservative accounting.`,
    });
  }

  const fcfs = f.cashFlow.map((c) => c.freeCashFlow).filter((v): v is number => v !== null);
  if (fcfs.length >= 3) {
    const positiveYears = fcfs.filter((v) => v > 0).length;
    const ratioPositive = (positiveYears / fcfs.length) * 100;
    const score = scaleScore(ratioPositive, [[0, -90], [40, -35], [70, 40], [100, 90]]);
    readings.push({
      key: "fcf-consistency",
      label: "Free cash flow consistency",
      display: `${positiveYears}/${fcfs.length} yrs positive`,
      raw: ratioPositive,
      direction: directionOf(score),
      score,
      weight: 2.5,
      conclusion:
        positiveYears === fcfs.length
          ? `Free cash flow was positive in all ${fcfs.length} reported years. Consistent FCF means the business self-funds its growth, pays dividends and reduces debt without returning to shareholders for money — the definition of a compounding machine.`
          : positiveYears === 0
            ? `Free cash flow was negative in every one of the ${fcfs.length} reported years. The business consumes more cash than it generates, so it depends on external funding. Acceptable only for a genuine high-growth story with a credible path to cash generation.`
            : `Free cash flow was positive in ${positiveYears} of ${fcfs.length} years. Intermittent cash generation typically reflects lumpy capital expenditure — check whether the negative years funded expansion or simply covered losses.`,
    });
  }

  if (recentCf?.freeCashFlow != null && recentPl?.revenue) {
    const fcfMargin = (recentCf.freeCashFlow / recentPl.revenue) * 100;
    const score = scaleScore(fcfMargin, [[-15, -90], [-5, -50], [0, -15], [6, 40], [12, 80], [22, 100]]);
    readings.push({
      key: "fcf-margin",
      label: "Free cash flow margin",
      display: pct(fcfMargin),
      raw: fcfMargin,
      direction: directionOf(score),
      score,
      weight: 2,
      conclusion: `The business converts ${fcfMargin.toFixed(1)}% of revenue into free cash. ${fcfMargin > 10 ? "That is a strong conversion rate and gives management real optionality — buybacks, dividends, acquisitions or debt reduction." : fcfMargin > 0 ? "Positive but modest; most cash is being reinvested rather than accumulated." : "Negative free cash margin means growth is being funded by external capital rather than operations."}`,
    });
  }

  const score = weightedScore(readings);
  return {
    key: "cash-flow",
    label: "Cash flow quality",
    description: "Whether reported profit becomes real cash",
    score,
    direction: directionOf(score),
    readings,
    summary: `Cash flow quality scores ${score.toFixed(0)}/100 across ${readings.length} measures.`,
  };
}

// ---------------------------------------------------------------------------
// Valuation
// ---------------------------------------------------------------------------

function buildValuationGroup(f: FundamentalSnapshot): SignalGroup {
  const readings: SignalReading[] = [];
  const v = f.valuation;

  if (v.peRatio !== null && v.peRatio > 0) {
    const score = scaleScore(v.peRatio, [[5, 85], [12, 65], [20, 25], [30, -15], [45, -60], [80, -95]]);
    readings.push({
      key: "pe-ratio",
      label: "Price to earnings",
      display: ratio(v.peRatio, 1),
      raw: v.peRatio,
      direction: directionOf(score),
      score,
      weight: 2.5,
      conclusion:
        v.peRatio < 15
          ? `A P/E of ${v.peRatio.toFixed(1)} is undemanding. Either the market is missing something, or it is pricing in a genuine deterioration — the job is to work out which, because cheap stocks are usually cheap for a reason.`
          : v.peRatio < 25
            ? `A P/E of ${v.peRatio.toFixed(1)} is around the market average. Valuation is neither the reason to buy nor the reason to avoid; the growth and quality signals decide this one.`
            : v.peRatio < 45
              ? `A P/E of ${v.peRatio.toFixed(1)} is a premium rating that requires sustained high growth to justify. The risk is not that the business disappoints in absolute terms, but that it merely grows well rather than exceptionally.`
              : `A P/E of ${v.peRatio.toFixed(1)} prices in years of flawless execution. At this multiple even a good result can trigger a sharp de-rating, so the margin of safety is effectively zero.`,
    });
  }

  // PEG: the cleanest way to reconcile a high multiple with high growth.
  const growthRate = f.growth.profitCagr3y ?? f.growth.revenueCagr3y;
  if (v.peRatio !== null && v.peRatio > 0 && growthRate !== null && growthRate > 0) {
    const peg = v.peRatio / growthRate;
    const score = scaleScore(peg, [[0.3, 95], [0.8, 70], [1.2, 25], [2, -30], [3.5, -80], [6, -100]]);
    readings.push({
      key: "peg",
      label: "PEG ratio",
      display: ratio(peg),
      raw: peg,
      direction: directionOf(score),
      score,
      weight: 2.2,
      conclusion:
        peg < 1
          ? `A PEG of ${peg.toFixed(2)} means you are paying less than one point of P/E for each point of growth. Classically this is the zone where growth is under-priced, and it is the strongest valuation argument available.`
          : peg < 2
            ? `A PEG of ${peg.toFixed(2)} is a fair price for the growth on offer. Reasonable rather than a bargain.`
            : `A PEG of ${peg.toFixed(2)} means the multiple is running well ahead of the growth rate. The stock needs an acceleration in growth — not just its continuation — to make the current price sensible.`,
    });
  }

  if (v.priceToBook !== null && v.priceToBook > 0) {
    const roe = f.ratios.roe;
    // P/B only means something relative to ROE — high P/B is justified by high ROE.
    const score =
      roe !== null && roe > 18
        ? scaleScore(v.priceToBook, [[1, 90], [4, 55], [8, 10], [14, -45], [25, -90]])
        : scaleScore(v.priceToBook, [[0.5, 85], [1.5, 55], [3, 5], [6, -55], [12, -95]]);
    readings.push({
      key: "price-to-book",
      label: "Price to book",
      display: ratio(v.priceToBook),
      raw: v.priceToBook,
      direction: directionOf(score),
      score,
      weight: 1.8,
      conclusion:
        roe !== null
          ? `P/B of ${v.priceToBook.toFixed(2)} against an ROE of ${roe.toFixed(1)}%. ${roe > 18 ? "High returns on equity genuinely justify a high book multiple — this pairing is internally consistent." : roe < 10 ? "A low ROE does not justify a premium to book. Paying several times book for single-digit returns on that book is a poor trade." : "The multiple and the return on equity are broadly consistent with each other."}`
          : `P/B of ${v.priceToBook.toFixed(2)}. Without a reliable ROE reading this figure is hard to interpret in isolation.`,
    });
  }

  if (v.evToEbitda !== null && v.evToEbitda > 0) {
    const score = scaleScore(v.evToEbitda, [[4, 85], [8, 55], [14, 10], [22, -50], [35, -95]]);
    readings.push({
      key: "ev-ebitda",
      label: "EV / EBITDA",
      display: ratio(v.evToEbitda, 1),
      raw: v.evToEbitda,
      direction: directionOf(score),
      score,
      weight: 1.6,
      conclusion: `EV/EBITDA of ${v.evToEbitda.toFixed(1)} values the whole enterprise including debt, which makes it more comparable across capital structures than P/E. ${v.evToEbitda < 10 ? "That is inexpensive on an enterprise basis." : v.evToEbitda < 18 ? "A fair enterprise valuation." : "An expensive enterprise valuation that assumes significant further growth."}`,
    });
  }

  if (v.dividendYield !== null && v.dividendYield > 0) {
    const score = scaleScore(v.dividendYield, [[0, 0], [1, 15], [2.5, 45], [4, 60], [8, 10]]);
    readings.push({
      key: "dividend-yield",
      label: "Dividend yield",
      display: pct(v.dividendYield, 2),
      raw: v.dividendYield,
      direction: directionOf(score),
      score,
      weight: 1,
      conclusion: `Dividend yield of ${v.dividendYield.toFixed(2)}%. ${v.dividendYield > 5 ? "Unusually high yields often signal that the market expects a cut — verify it is covered by free cash flow before relying on it." : v.dividendYield > 2 ? "A meaningful income component that also imposes capital discipline on management." : "A token payout; total return here will be driven by capital appreciation."}`,
    });
  }

  const score = weightedScore(readings);
  return {
    key: "valuation",
    label: "Valuation",
    description: "What you pay relative to what you get",
    score,
    direction: directionOf(score),
    readings,
    summary: `Valuation scores ${score.toFixed(0)}/100 across ${readings.length} measures.`,
  };
}

// ---------------------------------------------------------------------------
// Shareholding
// ---------------------------------------------------------------------------

function buildShareholdingGroup(f: FundamentalSnapshot): SignalGroup {
  const readings: SignalReading[] = [];
  const s = f.shareholding;

  if (s.promoter !== null) {
    const score = scaleScore(s.promoter, [[0, -40], [20, -10], [40, 40], [55, 75], [75, 85], [90, 30]]);
    readings.push({
      key: "promoter-holding",
      label: "Promoter / insider holding",
      display: pct(s.promoter),
      raw: s.promoter,
      direction: directionOf(score),
      score,
      weight: 2.5,
      conclusion:
        s.promoter > 50
          ? `Promoters hold ${s.promoter.toFixed(1)}%. A majority stake means the people running the business carry the same downside as minority shareholders — the strongest available alignment of interest.`
          : s.promoter > 30
            ? `Promoter holding of ${s.promoter.toFixed(1)}% is a substantial commitment without absolute control, which usually implies reasonable board accountability alongside genuine skin in the game.`
            : s.promoter > 10
              ? `Promoter holding of ${s.promoter.toFixed(1)}% is on the low side. Lower ownership weakens alignment and can leave the company vulnerable to short-term pressures.`
              : `Promoter holding of ${s.promoter.toFixed(1)}% is minimal. Where founders retain almost no stake, governance depends entirely on the board and institutional oversight.`,
    });
  }

  if (s.pledgedPercent !== null) {
    const score = s.pledgedPercent === 0 ? 60 : scaleScore(s.pledgedPercent, [[0, 60], [5, 10], [15, -55], [30, -90], [60, -100]]);
    readings.push({
      key: "pledged-shares",
      label: "Pledged promoter shares",
      display: pct(s.pledgedPercent),
      raw: s.pledgedPercent,
      direction: directionOf(score),
      score,
      weight: 2.2,
      conclusion:
        s.pledgedPercent === 0
          ? `No promoter shares are pledged. Clean, and it removes a whole category of forced-selling risk.`
          : s.pledgedPercent < 10
            ? `${s.pledgedPercent.toFixed(1)}% of promoter holding is pledged. A modest level, but worth monitoring — pledges tend to grow rather than shrink.`
            : `${s.pledgedPercent.toFixed(1)}% of promoter holding is pledged against loans. This is a serious structural risk: if the price falls, lenders can invoke the pledge and dump shares, which accelerates the decline exactly when the stock is already weak.`,
    });
  }

  if (s.institutions !== null) {
    const score = scaleScore(s.institutions, [[0, -25], [5, 10], [15, 50], [30, 75], [55, 60]]);
    readings.push({
      key: "institutional-holding",
      label: "Institutional holding",
      display: pct(s.institutions),
      raw: s.institutions,
      direction: directionOf(score),
      score,
      weight: 1.8,
      conclusion:
        s.institutions > 25
          ? `Institutions hold ${s.institutions.toFixed(1)}%. Heavy professional ownership signals that the company has passed rigorous due diligence, and it usually improves liquidity and disclosure standards.`
          : s.institutions > 10
            ? `Institutional holding of ${s.institutions.toFixed(1)}% shows meaningful professional participation without crowding.`
            : `Institutional holding of just ${s.institutions.toFixed(1)}% means professional money has largely stayed away. Sometimes that is a genuine under-researched opportunity; more often there is a reason.`,
    });
  }

  if (readings.length === 0) {
    readings.push({
      key: "shareholding-unavailable",
      label: "Ownership data",
      display: "—",
      raw: null,
      direction: "neutral",
      score: 0,
      weight: 1,
      conclusion:
        "Detailed shareholding data is not available from the current data source for this security, so ownership quality could not be assessed. Check the company's latest exchange filing for the current pattern.",
    });
  }

  const score = weightedScore(readings);
  return {
    key: "shareholding",
    label: "Ownership & governance",
    description: "Who owns the business and how aligned they are",
    score,
    direction: directionOf(score),
    readings,
    summary: `Ownership quality scores ${score.toFixed(0)}/100 across ${readings.length} measures.`,
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

const FUNDAMENTAL_WEIGHTS: Record<string, number> = {
  growth: 0.20,
  profitability: 0.24,
  "balance-sheet": 0.19,
  "cash-flow": 0.17,
  valuation: 0.13,
  shareholding: 0.07,
};

function toVerdict(score: number, confidence: number): Verdict {
  const adjusted = score * (0.55 + confidence / 220);
  if (adjusted >= 45) return "strong-buy";
  if (adjusted >= 18) return "accumulate";
  if (adjusted > -18) return "hold";
  if (adjusted > -45) return "reduce";
  return "avoid";
}

export function analyzeFundamental(f: FundamentalSnapshot): FundamentalAnalysis {
  const groups: SignalGroup[] = [
    buildGrowthGroup(f),
    buildProfitabilityGroup(f),
    buildBalanceSheetGroup(f),
    buildCashFlowGroup(f),
    buildValuationGroup(f),
    buildShareholdingGroup(f),
  ].filter((g) => g.readings.length > 0);

  let composite = 0;
  let weightSum = 0;
  for (const g of groups) {
    const w = FUNDAMENTAL_WEIGHTS[g.key] ?? 0.1;
    composite += g.score * w;
    weightSum += w;
  }
  const compositeScore = weightSum === 0 ? 0 : clamp(composite / weightSum);

  // Confidence blends data completeness with cross-group agreement.
  const totalReadings = groups.reduce((a, g) => a + g.readings.length, 0);
  const completeness = Math.min((totalReadings / 24) * 100, 100);
  const scores = groups.map((g) => g.score);
  const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / (scores.length || 1));
  const agreement = Math.max(0, 100 - sd * 1.3);
  const confidence = Math.round(clamp(completeness * 0.45 + agreement * 0.55, 0, 100));

  const verdict = toVerdict(compositeScore, confidence);

  // Quality tier depends on the durable factors, not the valuation of the day.
  const quality =
    (groups.find((g) => g.key === "profitability")?.score ?? 0) * 0.4 +
    (groups.find((g) => g.key === "balance-sheet")?.score ?? 0) * 0.35 +
    (groups.find((g) => g.key === "cash-flow")?.score ?? 0) * 0.25;
  const qualityTier: "high" | "moderate" | "speculative" =
    quality >= 40 ? "high" : quality >= 0 ? "moderate" : "speculative";

  // --- Narrative ----------------------------------------------------------
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const parts: string[] = [];

  const openers: Record<Verdict, string> = {
    "strong-buy": `${f.name} screens as a high-quality business at a workable price for a positional holding.`,
    accumulate: `${f.name} has a credible fundamental case for a positional position, with some caveats.`,
    hold: `${f.name} presents a mixed fundamental picture with no decisive edge either way.`,
    reduce: `${f.name} shows fundamental weaknesses that argue against building a position here.`,
    avoid: `${f.name} has serious fundamental problems that make it unsuitable for a positional holding.`,
  };
  parts.push(
    `${openers[verdict]} The composite fundamental score is ${compositeScore.toFixed(0)} out of 100, drawn from ${totalReadings} metrics across six areas, with ${confidence}% confidence. Overall business quality reads as ${qualityTier}.`,
  );

  for (const key of ["growth", "profitability", "balance-sheet", "cash-flow", "valuation", "shareholding"]) {
    const g = byKey.get(key);
    if (!g) continue;
    const top = [...g.readings].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
    if (top) parts.push(top.conclusion);
  }

  /**
   * The same summary as labelled points.
   *
   * The prose version joins eight sentences into one block, which nobody
   * finishes on a page they are scanning for a number. Each point below
   * answers exactly one question and the label column is what a reader jumps
   * between — someone who only wants the cash-flow read can find it without
   * reading the growth read first. The prose form is kept for the API and for
   * the summary card on the overview page, where a single string is wanted.
   */
  const narrativePoints: NarrativePoint[] = [];

  narrativePoints.push({
    label: "The call",
    text: `${openers[verdict]} Score ${compositeScore > 0 ? "+" : ""}${compositeScore.toFixed(0)} out of 100 at ${confidence}% confidence, from ${totalReadings} metrics. Business quality reads ${qualityTier}.`,
    tone: compositeScore >= 20 ? "bullish" : compositeScore <= -20 ? "bearish" : "neutral",
  });

  for (const key of GROUP_ORDER) {
    const g = byKey.get(key);
    if (!g) continue;
    const top = topReading(g);
    narrativePoints.push({
      label: POINT_LABELS[key] ?? g.label,
      text: top ? `${top.label} at ${top.display}. ${firstSentence(top.conclusion)}` : g.summary,
      tone: g.score >= 20 ? "bullish" : g.score <= -20 ? "bearish" : "neutral",
    });
  }

  /**
   * Name what is absent rather than letting it pass as a low score.
   *
   * This matters more than it looks. When statements are missing, the affected
   * groups score from very few metrics, and a reader seeing "Balance sheet:
   * +12" has no way to tell whether that is a considered judgement or an
   * average of one number. Saying so is the difference between a confidence
   * figure that is informative and one that is decorative.
   */
  const gaps: string[] = [];
  if (f.balanceSheet.length === 0) gaps.push("balance sheet");
  if (f.cashFlow.length === 0) gaps.push("cash flow");
  if (f.annual.length < 3) gaps.push("multi-year history");

  if (gaps.length > 0) {
    narrativePoints.push({
      label: "Data gaps",
      text: `No ${joinList(gaps)} data was available for this company, so those areas are scored from very few metrics and the confidence figure above already reflects that. Missing numbers are dropped, never estimated — an invented balance sheet would score well and mean nothing.`,
      tone: "neutral",
    });
  }

  const keyPoints = groups.map((g) => {
    const top = [...g.readings].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
    return `${g.label}: ${top ? `${top.label} at ${top.display}` : g.summary} — scores ${g.score.toFixed(0)}/100.`;
  });

  const risks: string[] = [];
  for (const g of groups) {
    if (g.score < -25) {
      const worst = [...g.readings].sort((a, b) => a.score - b.score)[0];
      if (worst) risks.push(`${g.label} is a weak point. ${worst.conclusion}`);
    }
  }
  const cashGroup = byKey.get("cash-flow");
  if (cashGroup && cashGroup.score < 0) {
    risks.push(
      "Earnings quality is the concern to prioritise here. Reported profit that does not convert to cash is the most common precursor to a permanent capital loss.",
    );
  }
  if (confidence < 50) {
    risks.push(
      `Confidence is only ${confidence}%, largely because several standard metrics were unavailable or the signals conflict. Treat this as a starting point for research rather than a conclusion.`,
    );
  }
  if (risks.length === 0) {
    risks.push(
      "No individual area scores poorly. The residual risks are the ones fundamentals cannot capture: management execution, regulatory change, competitive disruption and broad market de-rating.",
    );
  }

  return {
    symbol: f.symbol,
    asOf: new Date().toISOString(),
    compositeScore,
    verdict,
    confidence,
    groups,
    narrative: parts.join(" "),
    narrativePoints,
    keyPoints,
    risks,
    qualityTier,
    narrativeSource: "engine",
  };
}

// ---------------------------------------------------------------------------
// Narrative helpers
// ---------------------------------------------------------------------------

/**
 * Reading order for the summary.
 *
 * Deliberately not the weighting order. A reader works outward from what the
 * business does — grows, earns, survives, converts to cash — before arriving
 * at what it costs, so valuation comes late even though it is scored earlier.
 */
const GROUP_ORDER = [
  "growth",
  "profitability",
  "balance-sheet",
  "cash-flow",
  "valuation",
  "shareholding",
] as const;

/** Short headings for the point labels. Group labels are too long to scan. */
const POINT_LABELS: Record<string, string> = {
  growth: "Growth",
  profitability: "Profitability",
  "balance-sheet": "Balance sheet",
  "cash-flow": "Cash flow",
  valuation: "Valuation",
  shareholding: "Shareholding",
};

/**
 * The most significant reading in a group.
 *
 * Significance is absolute score, not sign: a badly negative reading inside an
 * otherwise positive group is the thing a reader most needs to see.
 */
function topReading(group: SignalGroup): SignalReading | undefined {
  return [...group.readings].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
}

/**
 * Trim a conclusion to its first sentence.
 *
 * Readings are written at length for the expandable detail cards, where the
 * reader has asked for depth. In a summary they have not. Decimals are
 * protected so "1.5x cover" does not split mid-number.
 */
function firstSentence(value: string): string {
  if (!value) return "";
  const match = value.match(/^.*?[.!?](?=\s+[A-Z(]|$)/s);
  const first = (match?.[0] ?? value).trim();
  return first.length > 0 ? first : value.trim();
}

/** "a, b and c" — used in prose, so an Oxford-comma-free join is correct. */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
