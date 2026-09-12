/**
 * Reproduces what /dashboard and /stock/[symbol] actually do, against the mock
 * gateway, and times it. Run:
 *
 *   node --experimental-strip-types --experimental-loader ./tests/alias-loader.mjs tests/latency.bench.mjs
 *
 * Each scenario runs in a fresh child-free module graph is not possible here,
 * so the harness resets the module caches it can and reports cold vs warm
 * separately instead.
 */
import { startMockSmartApi, stats, resetStats } from "./mock-smartapi.mjs";

const TICKERS = [
  "RELIANCE", "HDFCBANK", "INFY", "ICICIBANK", "BSE", "BHARTIARTL", "ETERNAL", "TCS",
  "SBIN", "M&M", "AXISBANK", "BAJFINANCE", "DIXON", "TMCV", "BEL", "KOTAKBANK",
  "TATAMOTORS", "LT", "WAAREEENER", "TRENT", "CDSL", "JIOFIN", "INDIGO", "PAYTM",
  "HAL", "MCX", "SUNPHARMA", "MARUTI", "ITC", "HINDUNILVR", "TITAN", "ADANIENT",
  "ADANIPORTS", "ASIANPAINT", "BAJAJFINSV", "BPCL", "CIPLA", "COALINDIA", "DIVISLAB",
  "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH", "HDFCLIFE", "HEROMOTOCO", "HINDALCO",
  "INDUSINDBK", "JSWSTEEL", "NESTLEIND", "NTPC", "ONGC", "POWERGRID", "SBILIFE",
  "SHRIRAMFIN", "TATACONSUM", "TATASTEEL", "TECHM", "ULTRACEMCO", "WIPRO", "KAYNES",
];

const mock = await startMockSmartApi(TICKERS);

process.env.ANGEL_API_BASE = mock.base;
process.env.ANGEL_SCRIP_MASTER_URL = mock.scripMasterUrl;
process.env.ANGEL_API_KEY = "mock-key";
process.env.ANGEL_CLIENT_CODE = "A123456";
process.env.ANGEL_PIN = "1234";
process.env.ANGEL_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
delete process.env.MARKETMIND_FORCE_SAMPLE;

const service = await import("@/lib/data/service");
const { screenerUniverse, BENCHMARK } = await import("@/lib/data/universe");

async function timed(label, fn) {
  resetStats();
  const t0 = Date.now();
  const out = await fn();
  const ms = Date.now() - t0;
  const calls = stats.login + stats.history + stats.quote;
  console.log(
    `${label.padEnd(44)} ${String(ms).padStart(7)} ms   ` +
      `[scrip ${stats.scripMaster} · login ${stats.login} · hist ${stats.history} · quote ${stats.quote} = ${calls} calls]`,
  );
  return { ms, out };
}

const slice = screenerUniverse("liquid").slice(0, 40).map((u) => u.symbol);

// The very first pass now returns fast with sample data while the instrument
// master lands, and holds it for two seconds only. Measure that pass, then
// wait for the download and measure the real thing — which is what a user's
// second page view actually gets.
console.log("\n=========== FIRST EVER REQUEST (instrument master still downloading) ===========");
await timed("first pass: returns immediately", async () => {
  await service.getHistory("RELIANCE.NS", "daily", "2y");
});

const instruments = await import("@/lib/data/angel/instruments");
const t0 = Date.now();
while (!instruments.instrumentStatus().loaded && Date.now() - t0 < 30_000) {
  await new Promise((r) => setTimeout(r, 100));
}
console.log(`instrument master ready after ${Date.now() - t0} ms of background download`);
await new Promise((r) => setTimeout(r, 2_100)); // let the transient TTL expire

console.log("\n=========== DASHBOARD (\"open the desk\") ===========");
await timed("cold: 40 histories + benchmark", async () => {
  await Promise.all([
    service.getHistoryBatch(slice, "daily", "2y", 10),
    service.getHistory(BENCHMARK.symbol, "daily", "1y"),
  ]);
});
await timed("warm: same again", async () => {
  await Promise.all([
    service.getHistoryBatch(slice, "daily", "2y", 10),
    service.getHistory(BENCHMARK.symbol, "daily", "1y"),
  ]);
});

console.log("\n=========== STOCK PAGE (search -> open) ===========");
await timed("cold-ish: quote + 5y history + fundamentals", async () => {
  await Promise.all([
    service.getQuote("KAYNES.NS"),
    service.getHistory("KAYNES.NS", "daily", "5y"),
  ]);
});
await timed("warm: same symbol again", async () => {
  await Promise.all([
    service.getQuote("KAYNES.NS"),
    service.getHistory("KAYNES.NS", "daily", "5y"),
  ]);
});
await timed("cold: a different symbol", async () => {
  await Promise.all([
    service.getQuote("DIXON.NS"),
    service.getHistory("DIXON.NS", "daily", "5y"),
  ]);
});

await mock.close();
console.log("");
