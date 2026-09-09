import type {
  BalanceSheetPeriod,
  Candle,
  CashFlowPeriod,
  FinancialPeriod,
  FundamentalSnapshot,
  Quote,
  Timeframe,
} from "@/types";
import { displaySymbol, findInUniverse } from "./universe";
import { resample } from "@/lib/indicators";

/**
 * Deterministic sample-data engine.
 *
 * PURPOSE: guarantee the product is fully explorable when the upstream market
 * data API is rate-limited, blocked, or down — and during local development
 * with no network. Everything here is seeded from the symbol string, so the
 * same symbol always yields the same series. Output is clearly labelled as
 * sample data in the UI; it is never presented as real market data.
 */

/** xorshift32 — small, fast, and stable across platforms. */
function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Box-Muller transform for normally distributed returns. */
function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  const v = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const TRADING_DAYS_PER_YEAR = 252;

/**
 * Generate a realistic daily price series using geometric Brownian motion with
 * regime shifts, so charts show genuine trends and consolidations rather than
 * uniform noise — which is what makes indicator output meaningful.
 */
export function sampleCandles(symbol: string, timeframe: Timeframe = "daily", years = 5): Candle[] {
  const seed = hashString(symbol);
  const rng = makeRng(seed);

  const entry = findInUniverse(symbol);
  // Anchor the starting price on the symbol hash for variety across names.
  const basePrice = 180 + (seed % 3200);
  const annualDrift = 0.04 + (rng() - 0.35) * 0.30;
  const annualVol = 0.20 + rng() * 0.28;

  const totalDays = Math.round(TRADING_DAYS_PER_YEAR * years);
  const dt = 1 / TRADING_DAYS_PER_YEAR;
  const dailyDrift = (annualDrift - (annualVol * annualVol) / 2) * dt;
  const dailyVol = annualVol * Math.sqrt(dt);

  // Regime engine: alternate trending and ranging phases.
  let regimeBarsLeft = 0;
  let regimeDrift = 0;
  let regimeVolMultiplier = 1;

  const candles: Candle[] = [];
  let price = basePrice;

  // Walk backwards from today so the series ends on the most recent weekday.
  const end = new Date();
  end.setUTCHours(10, 0, 0, 0);
  const dates: number[] = [];
  const cursor = new Date(end);
  while (dates.length < totalDays) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.getTime());
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  dates.reverse();

  const baseVolume = 400_000 + (seed % 40) * 120_000;

  for (let i = 0; i < dates.length; i += 1) {
    if (regimeBarsLeft <= 0) {
      regimeBarsLeft = 30 + Math.floor(rng() * 90);
      const roll = rng();
      if (roll < 0.4) {
        regimeDrift = 0.0011 + rng() * 0.0016; // bullish leg
        regimeVolMultiplier = 0.85 + rng() * 0.3;
      } else if (roll < 0.68) {
        regimeDrift = -0.0010 - rng() * 0.0015; // corrective leg
        regimeVolMultiplier = 1.1 + rng() * 0.5;
      } else {
        regimeDrift = (rng() - 0.5) * 0.0004; // range
        regimeVolMultiplier = 0.55 + rng() * 0.3;
      }
    }
    regimeBarsLeft -= 1;

    const shock = gaussian(rng) * dailyVol * regimeVolMultiplier;
    const ret = dailyDrift + regimeDrift + shock;
    const open = price;
    price = Math.max(2, price * Math.exp(ret));

    const bodyHigh = Math.max(open, price);
    const bodyLow = Math.min(open, price);
    const wick = (bodyHigh - bodyLow) * (0.3 + rng() * 1.4) + open * 0.002;

    // Volume expands on larger moves — mirrors real participation.
    const moveIntensity = Math.min(Math.abs(ret) / (dailyVol * 2 + 1e-9), 3);
    const volume = Math.round(baseVolume * (0.55 + rng() * 0.9 + moveIntensity * 0.5));

    candles.push({
      time: dates[i],
      open,
      high: bodyHigh + wick * rng(),
      low: Math.max(1, bodyLow - wick * rng()),
      close: price,
      volume,
    });
  }

  void entry;
  if (timeframe === "daily") return candles;

  // Reuse the shared resampler for consistency with live data handling.
  return resample(candles, timeframe);
}

export function sampleQuote(symbol: string): Quote {
  const candles = sampleCandles(symbol, "daily", 2);
  const entry = findInUniverse(symbol);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const window = candles.slice(-252);
  const seed = hashString(symbol);

  const change = last.close - prev.close;
  return {
    symbol,
    name: entry?.name ?? displaySymbol(symbol),
    exchange: "NSE (sample)",
    currency: "INR",
    price: last.close,
    previousClose: prev.close,
    change,
    changePercent: prev.close === 0 ? 0 : (change / prev.close) * 100,
    dayHigh: last.high,
    dayLow: last.low,
    fiftyTwoWeekHigh: Math.max(...window.map((c) => c.high)),
    fiftyTwoWeekLow: Math.min(...window.map((c) => c.low)),
    volume: last.volume,
    averageVolume: window.reduce((a, c) => a + c.volume, 0) / window.length,
    marketCap: last.close * (50_000_000 + (seed % 900) * 1_000_000),
    peRatio: 14 + (seed % 45),
    sector: entry?.sector ?? "Diversified",
    industry: entry?.sector ?? "Diversified",
  };
}

/**
 * Generate an internally consistent set of financials: the balance sheet
 * balances, cash flow reconciles to profit, and growth rates compound cleanly.
 */
export function sampleFundamentals(symbol: string): FundamentalSnapshot {
  const seed = hashString(`${symbol}-fundamentals`);
  const rng = makeRng(seed);
  const entry = findInUniverse(symbol);
  const quote = sampleQuote(symbol);

  const growthRate = 0.06 + rng() * 0.20;
  const netMargin = 0.06 + rng() * 0.16;
  const opMargin = netMargin + 0.04 + rng() * 0.08;
  const baseRevenue = 25_000_000_000 + (seed % 500) * 900_000_000;

  const currentYear = new Date().getUTCFullYear();
  const annual: FinancialPeriod[] = [];
  for (let i = 4; i >= 0; i -= 1) {
    const revenue = baseRevenue / Math.pow(1 + growthRate, i);
    const marginDrift = 1 - i * 0.006 * (rng() > 0.5 ? 1 : -1);
    const netProfit = revenue * netMargin * marginDrift;
    const operatingProfit = revenue * opMargin * marginDrift;
    const fy = currentYear - i;
    annual.push({
      label: `FY${String(fy).slice(2)}`,
      endDate: `${fy}-03-31`,
      revenue,
      operatingProfit,
      netProfit,
      eps: netProfit / (80_000_000 + (seed % 200) * 1_000_000),
      operatingMargin: (operatingProfit / revenue) * 100,
      netMargin: (netProfit / revenue) * 100,
    });
  }

  const quarterly: FinancialPeriod[] = [];
  const latestAnnualRevenue = annual[annual.length - 1].revenue ?? baseRevenue;
  for (let i = 7; i >= 0; i -= 1) {
    const seasonality = 1 + Math.sin((i / 4) * Math.PI) * 0.06;
    const revenue = (latestAnnualRevenue / 4) * seasonality * Math.pow(1 + growthRate / 4, -i);
    const netProfit = revenue * netMargin * (0.95 + rng() * 0.12);
    const operatingProfit = revenue * opMargin * (0.95 + rng() * 0.12);
    const qIndex = 7 - i;
    quarterly.push({
      label: `Q${(qIndex % 4) + 1} FY${String(currentYear - Math.floor(i / 4)).slice(2)}`,
      endDate: `${currentYear - Math.floor(i / 4)}-${String(((qIndex % 4) + 1) * 3).padStart(2, "0")}-30`,
      revenue,
      operatingProfit,
      netProfit,
      eps: netProfit / (80_000_000 + (seed % 200) * 1_000_000),
      operatingMargin: (operatingProfit / revenue) * 100,
      netMargin: (netProfit / revenue) * 100,
    });
  }

  const debtToEquity = 0.1 + rng() * 1.1;
  const balanceSheet: BalanceSheetPeriod[] = annual.map((a, i) => {
    const revenue = a.revenue ?? baseRevenue;
    const equity = revenue * (0.55 + rng() * 0.5);
    const debt = equity * debtToEquity * (1 - i * 0.02);
    const cash = revenue * (0.08 + rng() * 0.12);
    const currentAssets = revenue * (0.35 + rng() * 0.2);
    const currentLiabilities = currentAssets / (1.2 + rng() * 1.1);
    const totalAssets = equity + debt + currentLiabilities * 1.3;
    return {
      label: a.label,
      endDate: a.endDate,
      totalAssets,
      totalLiabilities: totalAssets - equity,
      totalEquity: equity,
      totalDebt: debt,
      cash,
      currentAssets,
      currentLiabilities,
      inventory: currentAssets * (0.2 + rng() * 0.2),
      receivables: currentAssets * (0.25 + rng() * 0.2),
    };
  });

  const cashFlow: CashFlowPeriod[] = annual.map((a) => {
    const netProfit = a.netProfit ?? 0;
    // Cash conversion between 0.85x and 1.35x of reported profit.
    const ocf = netProfit * (0.85 + rng() * 0.5);
    const capex = -(a.revenue ?? 0) * (0.03 + rng() * 0.06);
    return {
      label: a.label,
      endDate: a.endDate,
      operatingCashFlow: ocf,
      investingCashFlow: capex * (1 + rng()),
      financingCashFlow: -ocf * (0.15 + rng() * 0.4),
      capex,
      freeCashFlow: ocf + capex,
    };
  });

  const promoter = 30 + rng() * 45;
  const fii = rng() * (95 - promoter) * 0.45;
  const dii = rng() * (95 - promoter - fii) * 0.6;

  const latestAnnual = annual[annual.length - 1];
  const latestBs = balanceSheet[balanceSheet.length - 1];
  const equity = latestBs.totalEquity ?? 1;
  const netProfit = latestAnnual.netProfit ?? 0;
  const revenue = latestAnnual.revenue ?? 1;

  const revenueCagr3y =
    (Math.pow(revenue / (annual[annual.length - 4].revenue ?? revenue), 1 / 3) - 1) * 100;
  const revenueCagr5y =
    (Math.pow(revenue / (annual[0].revenue ?? revenue), 1 / 4) - 1) * 100;
  const profitCagr3y =
    (Math.pow(netProfit / (annual[annual.length - 4].netProfit ?? netProfit), 1 / 3) - 1) * 100;
  const profitCagr5y =
    (Math.pow(netProfit / (annual[0].netProfit ?? netProfit), 1 / 4) - 1) * 100;

  return {
    symbol,
    name: entry?.name ?? displaySymbol(symbol),
    sector: entry?.sector ?? "Diversified",
    industry: entry?.sector ?? "Diversified",
    currency: "INR",
    annual,
    quarterly,
    balanceSheet,
    cashFlow,
    shareholding: {
      promoter,
      fii,
      dii,
      public: Math.max(0, 100 - promoter - fii - dii),
      insider: promoter,
      institutions: fii + dii,
      pledgedPercent: rng() > 0.75 ? rng() * 12 : 0,
      asOf: new Date().toISOString().slice(0, 10),
    },
    valuation: {
      peRatio: quote.peRatio,
      forwardPe: (quote.peRatio ?? 20) * (0.82 + rng() * 0.2),
      priceToBook: 1.2 + rng() * 6,
      priceToSales: 1 + rng() * 5,
      evToEbitda: 8 + rng() * 18,
      pegRatio: revenueCagr3y > 0 ? (quote.peRatio ?? 20) / revenueCagr3y : null,
      dividendYield: rng() * 2.6,
      earningsYield: quote.peRatio ? (1 / quote.peRatio) * 100 : null,
      marketCap: quote.marketCap,
      enterpriseValue: (quote.marketCap ?? 0) + (latestBs.totalDebt ?? 0) - (latestBs.cash ?? 0),
    },
    ratios: {
      roe: (netProfit / equity) * 100,
      roa: (netProfit / (latestBs.totalAssets ?? 1)) * 100,
      roce: ((latestAnnual.operatingProfit ?? 0) / (equity + (latestBs.totalDebt ?? 0))) * 100,
      debtToEquity: (latestBs.totalDebt ?? 0) / equity,
      currentRatio: (latestBs.currentAssets ?? 0) / (latestBs.currentLiabilities ?? 1),
      quickRatio:
        ((latestBs.currentAssets ?? 0) - (latestBs.inventory ?? 0)) / (latestBs.currentLiabilities ?? 1),
      interestCoverage: 3 + rng() * 14,
      grossMargin: (opMargin + 0.12) * 100,
      operatingMargin: ((latestAnnual.operatingProfit ?? 0) / revenue) * 100,
      netMargin: (netProfit / revenue) * 100,
      assetTurnover: revenue / (latestBs.totalAssets ?? 1),
    },
    growth: {
      revenueCagr3y,
      revenueCagr5y,
      profitCagr3y,
      profitCagr5y,
      revenueYoy: ((revenue / (annual[annual.length - 2].revenue ?? revenue)) - 1) * 100,
      profitYoy: ((netProfit / (annual[annual.length - 2].netProfit ?? netProfit)) - 1) * 100,
      epsGrowthYoy:
        (((latestAnnual.eps ?? 0) / (annual[annual.length - 2].eps ?? latestAnnual.eps ?? 1)) - 1) * 100,
    },
  };
}
