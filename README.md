# MarketMind

Swing and positional analysis for Indian equities. Technical and fundamental workups with written conclusions, a custom screener, and honest strategy backtesting.

**Scope: swing (1–6 weeks) and positional (3–12+ months) only.** Intraday is deliberately excluded — not just from the UI, but from the type system itself. `Timeframe` is `"daily" | "weekly" | "monthly"`, so an intraday path cannot be added by accident.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. No API key, no database, no configuration required.

---

## Deploying to Vercel

The repo is deploy-ready — no environment variables are needed.

**Option A — via GitHub (recommended)**

```bash
git init
git add -A
git commit -m "MarketMind"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then go to [vercel.com/new](https://vercel.com/new), import the repository, and press Deploy. Vercel detects Next.js automatically.

**Option B — from the command line**

```bash
npm i -g vercel
vercel        # preview deployment
vercel --prod # production
```

### Notes for production

- The screener route sets `maxDuration = 60` and keeps its fetch budget just under that, so a scan always returns partial results rather than being killed mid-flight.
- Nothing is secret, so there are no environment variables to configure. The only optional one is `MARKETMIND_FORCE_SAMPLE` (below).
- Market data comes from Angel One SmartAPI, which needs the four credentials described below. Fundamentals come from Yahoo Finance. Both are rate limited, and the app degrades to clearly-labelled sample data rather than failing when either is unavailable.

### Setting up live data

MarketMind reads prices from **Angel One SmartAPI**. Four environment variables are needed:

```bash
ANGEL_API_KEY=          # from smartapi.angelbroking.com, app type "Trading API"
ANGEL_CLIENT_CODE=      # your Angel One login ID
ANGEL_PIN=              # your numeric login PIN
ANGEL_TOTP_SECRET=      # the base32 secret behind the TOTP QR code
```

`ANGEL_TOTP_SECRET` is the **secret**, not a six-digit code — the same string you would paste into an authenticator app. The client generates codes from it on demand.

One setting is easy to miss: **Historical Data must be enabled for the API key** in the SmartAPI dashboard. Without it, login succeeds and candles come back empty, which looks like a bug but is a permissions setting.

Without these variables the app still runs. Every price becomes generated sample data, labelled as such on every view.

### Checking that live data is actually working

Open **`/api/health`**. It forces a fresh login and names the exact problem if there is one:

```jsonc
{
  "status": "live",                    // or "degraded" / "forced-sample"
  "universeSize": 3153,
  "angelOne": {
    "configured": true,
    "missingEnvVars": [],
    "authenticated": true,
    "probeOk": true,
    "probeMessage": "Live. 1243 daily candles for RELIANCE.",
    "instruments": { "loaded": true, "count": 2187 },
    "requestsLeftThisMinute": 176
  },
  "resolved": {
    "history": { "origin": "live", "provider": "angelone", "asOf": "2026-09-08" }
  }
}
```

When `status` is `degraded`, read `advice`. Login and the instrument master are probed **separately**, because they fail independently and mean different things:

- `login.ok: true` with a failing instrument master means **your credentials are fine** — the problem is downloading Angel One's scrip master, a file of tens of megabytes. Raise `ANGEL_SCRIP_TIMEOUT_MS` if it is timing out.
- `login.ok: false` means the credentials or TOTP secret are wrong.
- Both fine but no candles means **Historical Data is not enabled for the API key** in the SmartAPI dashboard. Login still succeeds in that state, which makes it look like a bug in the app.

A failed instrument download is remembered for a minute, and page requests wait at most eight seconds for it before falling back to sample data while it continues in the background. So a slow first load does not stall the app, and once the file lands everything switches to live data without a restart.

### The stock universe

`nse-universe.ts` carries **3,153 symbols** — every name that traded in the EQ, BE, BZ, SM or ST series across a recent sample of NSE bhavcopy sessions. Rows are ordered by median daily turnover, so index 0 is the most liquid stock on the exchange.

That ordering is load-bearing. Search runs over the whole list instantly because it needs no network. Bulk scanning cannot: at three requests per second, 3,153 cold symbols take about eighteen minutes, far beyond any serverless execution limit.

The screener therefore offers four depths — top 300, top 750, top 1500, and **everything**. The first three add progressively less liquid names rather than arbitrary ones. "Everything" includes ETFs and SME scrips too, because a tier labelled that way quietly dropping several hundred rows is exactly the kind of invisible gap that makes a screener untrustworthy.

A full scan spends a fixed time budget, returns what it read, caches it, and reports how far it got. Pressing **Continue scan** resumes from the cache, so successive runs converge on a complete result. On a self-hosted server with no request timeout, set `MARKETMIND_SCAN_BUDGET_MS` high enough and the whole universe finishes in one run.

New listings need no redeploy: instrument tokens come from Angel One's scrip master, which is fetched at runtime and refreshed daily, so a stock that listed this morning is tradeable in the app the same day.

The table is ~120 KB and marked `server-only`. Client components import `symbols.ts` instead, which holds only pure string helpers and short constants, so the universe never reaches the browser bundle.

---

## How the analysis works

### Technical

Each indicator is mapped onto a single −100…+100 scale and placed in one of five groups. The groups are then blended using weights that **differ by horizon**:

| Group | Swing | Positional |
| --- | --- | --- |
| Trend | 28% | 40% |
| Momentum | 30% | 18% |
| Structure | 18% | 22% |
| Volume | 14% | 12% |
| Volatility | 10% | 8% |

Positional analysis also runs on weekly candles rather than daily. Together these mean the two horizons can legitimately disagree about the same chart — which is itself information.

Every reading carries a written conclusion. ADX below 20 does not say "weak trend"; it says there is no trend to ride and that breakout entries fail most often in exactly that regime.

**Confidence** measures agreement between groups, not the strength of the call. When groups contradict each other, the verdict is pulled toward neutral and the contradiction appears in the risks section.

### Fundamental

Six groups: growth (20%), profitability (24%), balance sheet (19%), cash flow (17%), valuation (13%), shareholding (7%).

Cash flow is weighted heavily because operating cash flow ÷ net profit is the single best filter for earnings quality — reported profit that never becomes cash is the most common precursor to permanent capital loss. Valuation is weighted lowest, because a cheap bad business rarely works out.

Missing data is dropped rather than guessed. An absent metric lowers confidence instead of silently biasing the score.

### Backtesting

Four rules the engine will not break:

1. **No lookahead.** A signal computed on bar *i* executes at the **open of bar i+1**. You can never trade on a close you have not yet seen.
2. **Real costs.** Brokerage (0.03%), slippage (0.05%) and STT on the sell side (0.1%) are charged on every trade.
3. **Stops resolve intrabar** against the bar's actual low, including gap-throughs.
4. **Long only.** Modelling shorts would require borrow costs that cannot be estimated honestly.

Strategies are state-based rather than transition-based — a trader following "be long while fast EMA > slow EMA" is long on the first day they look at the chart, not only after an observed crossover. Transition-based entries silently skip any trend already underway when the window opens.

---

## Testing

```
npm test   # 58 tests, 17 suites
```

Indicator tests check output against hand-calculated values (SMA of 1,2,3 is 2; RSI on a monotonic rise is 100; MACD histogram equals macd − signal). Backtest tests verify no-lookahead by asserting every entry price is a real bar open, that costs make a flat market unprofitable, and that trades never overlap.

---

## Data sources and limitations

- Market data: Yahoo Finance public endpoints. Undocumented, rate-limited, and occasionally missing fields for Indian securities. The app handles all three.
- Shareholding: Yahoo exposes insider and institutional percentages but **not** the promoter/FII/DII split or pledge data that Indian filings contain. Where those are unavailable the UI shows a dash and confidence drops. For pledge data specifically, check the company's latest exchange filing.
- The screening universe is ~110 curated liquid NSE names rather than the full Nifty 500, because a cold scan fetches history per symbol and serverless platforms enforce execution limits.

---

## Disclaimer

MarketMind is an analysis tool, not an investment adviser. Everything it produces comes from a rules engine reading historical price and filing data. It knows nothing about your capital, timeframe, tax position or tolerance for a drawdown. Markets can move against any analysis. Do your own research, and consider speaking to a SEBI-registered adviser before acting.
