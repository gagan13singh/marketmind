/**
 * Not a test — a stopwatch. Run with:
 *   node --experimental-strip-types --experimental-loader ./tests/alias-loader.mjs tests/perf.bench.ts
 *
 * Isolates CPU cost from network cost so the two can be fixed separately.
 */
import { sampleCandles } from "@/lib/data/sample";
import { analyzeTechnical } from "@/lib/analysis/technical";
import { screenerUniverse } from "@/lib/data/universe";
import { searchUniverse } from "@/lib/data/universe";

function time<T>(label: string, fn: () => T): T {
  const t0 = performance.now();
  const out = fn();
  const ms = performance.now() - t0;
  console.log(`${label.padEnd(52)} ${ms.toFixed(1)} ms`);
  return out;
}

console.log("\n--- module load ---");
time("screenerUniverse('liquid') first call", () => screenerUniverse("liquid"));
time("searchUniverse('RELI')", () => searchUniverse("RELI", 8));
time("searchUniverse('bank') x20", () => {
  for (let i = 0; i < 20; i += 1) searchUniverse("bank", 8);
});

console.log("\n--- analysis engine (CPU only, sample candles) ---");
const daily5y = sampleCandles("RELIANCE.NS", "daily", 5);
console.log(`candles: ${daily5y.length}`);

time("analyzeTechnical swing/daily  x1", () => analyzeTechnical("X", daily5y, "swing", "daily"));
time("analyzeTechnical 4 variants (technical page) x1", () => {
  analyzeTechnical("X", daily5y, "swing", "daily");
  analyzeTechnical("X", daily5y, "swing", "weekly");
  analyzeTechnical("X", daily5y, "positional", "weekly");
  analyzeTechnical("X", daily5y, "positional", "monthly");
});

const daily2y = sampleCandles("RELIANCE.NS", "daily", 2);
time("dashboard: 40 x analyzeTechnical swing/daily (2y)", () => {
  for (let i = 0; i < 40; i += 1) analyzeTechnical(`S${i}`, daily2y, "swing", "daily");
});

console.log("");
