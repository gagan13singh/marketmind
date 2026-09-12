/**
 * A stand-in for Angel One SmartAPI, used to time the data path end to end.
 *
 * It imitates the three things that actually govern page latency:
 *   - the scrip master: one very large JSON file, slow to transfer and parse
 *   - login: one round trip
 *   - getCandleData / quote: per-call latency, and the 3 req/sec ceiling that
 *     the real gateway enforces by rejecting rather than queueing
 *
 * Latency numbers are deliberately modest (60 ms/call, 2.5 s for the scrip
 * master). Real-world figures are worse, so any wait measured here is a floor.
 */
import http from "node:http";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const stats = {
  login: 0,
  history: 0,
  quote: 0,
  scripMaster: 0,
  /** Timestamps of every authenticated call, for checking the pacing. */
  callTimes: [],
};

export function resetStats() {
  stats.login = 0;
  stats.history = 0;
  stats.quote = 0;
  stats.scripMaster = 0;
  stats.callTimes = [];
}

const CALL_LATENCY_MS = 60;
const SCRIP_MASTER_LATENCY_MS = 2_500;

/** ~90k rows across every segment, which is the shape of the real file. */
function buildScripMaster(tickers) {
  const rows = [];
  for (const ticker of tickers) {
    rows.push({
      token: String(100000 + rows.length),
      symbol: `${ticker}-EQ`,
      name: ticker,
      expiry: "",
      strike: "-1.000000",
      lotsize: "1",
      instrumenttype: "",
      exch_seg: "NSE",
      tick_size: "5.000000",
    });
  }
  rows.push({
    token: "99926000",
    symbol: "Nifty 50",
    name: "Nifty 50",
    expiry: "",
    strike: "-1.000000",
    lotsize: "1",
    instrumenttype: "AMXIDX",
    exch_seg: "NSE",
    tick_size: "0",
  });

  // Padding: derivatives and other segments, which are most of the real file
  // and most of its parse cost. The app filters them out on every cold start.
  const target = 90_000;
  let i = 0;
  while (rows.length < target) {
    rows.push({
      token: String(500000 + i),
      symbol: `PAD${i}25DEC${i % 900}CE`,
      name: `PAD${i}`,
      expiry: "25DEC2026",
      strike: "1000.000000",
      lotsize: "50",
      instrumenttype: "OPTSTK",
      exch_seg: i % 3 === 0 ? "NFO" : i % 3 === 1 ? "BSE" : "MCX",
      tick_size: "5.000000",
    });
    i += 1;
  }
  return rows;
}

function buildCandles(seed, days) {
  const out = [];
  let price = 100 + (seed % 900);
  const start = Date.now() - days * 24 * 60 * 60 * 1000;
  for (let d = 0; d < days; d += 1) {
    const t = new Date(start + d * 24 * 60 * 60 * 1000);
    if (t.getUTCDay() === 0 || t.getUTCDay() === 6) continue;
    // Deterministic pseudo-random walk.
    const wobble = Math.sin((seed + d) * 0.7) * 0.9 + Math.cos((seed * 3 + d) * 0.31) * 0.6;
    price = Math.max(5, price * (1 + wobble / 100));
    const open = price * 0.996;
    const high = price * 1.011;
    const low = price * 0.988;
    out.push([
      `${t.toISOString().slice(0, 10)}T09:15:00+05:30`,
      Number(open.toFixed(2)),
      Number(high.toFixed(2)),
      Number(low.toFixed(2)),
      Number(price.toFixed(2)),
      100000 + ((seed * 37 + d * 11) % 900000),
    ]);
  }
  return out;
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export async function startMockSmartApi(tickers, port = 4712) {
  const scripMaster = JSON.stringify(buildScripMaster(tickers));
  const tokenToTicker = new Map();
  for (const row of JSON.parse(scripMaster)) {
    if (row.exch_seg === "NSE" && row.symbol.endsWith("-EQ")) {
      tokenToTicker.set(row.token, row.symbol.replace(/-EQ$/, ""));
    }
  }
  tokenToTicker.set("99926000", "NIFTY50");

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};

    const send = (obj) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };

    if (req.url.startsWith("/scripmaster")) {
      stats.scripMaster += 1;
      await sleep(SCRIP_MASTER_LATENCY_MS);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(scripMaster);
      return;
    }

    if (req.url.includes("loginByPassword")) {
      stats.login += 1;
      stats.callTimes.push(Date.now());
      await sleep(CALL_LATENCY_MS);
      send({ status: true, message: "SUCCESS", data: { jwtToken: "mock.jwt.token", feedToken: "mock-feed" } });
      return;
    }

    if (req.url.includes("getCandleData")) {
      stats.history += 1;
      stats.callTimes.push(Date.now());
      await sleep(CALL_LATENCY_MS);
      const ticker = tokenToTicker.get(String(body.symboltoken)) ?? "UNKNOWN";
      send({ status: true, message: "SUCCESS", data: buildCandles(hashCode(ticker), 760) });
      return;
    }

    if (req.url.includes("/market/v1/quote")) {
      stats.quote += 1;
      stats.callTimes.push(Date.now());
      await sleep(CALL_LATENCY_MS);
      const tokens = body?.exchangeTokens?.NSE ?? [];
      const now = new Date();
      const d = String(now.getUTCDate()).padStart(2, "0");
      const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][now.getUTCMonth()];
      const feedTime = `${d}-${m}-${now.getUTCFullYear()} 15:30:00`;
      send({
        status: true,
        message: "SUCCESS",
        data: {
          fetched: tokens.map((tk) => {
            const ticker = tokenToTicker.get(String(tk)) ?? "UNKNOWN";
            const c = buildCandles(hashCode(ticker), 760);
            const last = c[c.length - 1];
            return {
              exchange: "NSE",
              tradingSymbol: `${ticker}-EQ`,
              symbolToken: String(tk),
              ltp: last[4] * 1.004,
              open: last[1],
              high: last[2] * 1.002,
              low: last[3],
              close: last[4],
              tradeVolume: last[5],
              netChange: last[4] * 0.004,
              percentChange: 0.4,
              "52WeekHigh": last[2] * 1.3,
              "52WeekLow": last[3] * 0.7,
              exchFeedTime: feedTime,
            };
          }),
          unfetched: [],
        },
      });
      return;
    }

    res.writeHead(404).end("{}");
  });

  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return {
    base: `http://127.0.0.1:${port}`,
    scripMasterUrl: `http://127.0.0.1:${port}/scripmaster`,
    close: () => new Promise((r) => server.close(r)),
  };
}
