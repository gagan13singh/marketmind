import { NextResponse } from "next/server";
import { z } from "zod";
import { getHistoryBatchBudgeted } from "@/lib/data/service";
import { SCAN_TIERS, screenerUniverse } from "@/lib/data/universe";
import { buildRow, matchesAll } from "@/lib/screener";
import type { DataOrigin, ScreenerRow } from "@/types";

export const runtime = "nodejs";
/**
 * The screener fetches history for the whole universe on a cold cache, so it
 * needs more than the default execution budget. 60s is the ceiling on Vercel's
 * Pro plan; Hobby caps at 60s for Node functions too.
 */
export const maxDuration = 60;

/**
 * How long a single scan may spend fetching.
 *
 * The default sits just under the 60-second serverless ceiling so a scan
 * always returns something rather than being killed mid-flight. Angel One
 * allows three history requests per second, so that is roughly 120 cold
 * symbols per run — fine for the ranked tiers, but the full universe needs
 * many runs.
 *
 * Self-hosted deployments have no such ceiling. Set MARKETMIND_SCAN_BUDGET_MS
 * to something like 1200000 (20 minutes) there and the whole universe
 * completes in a single run.
 */
function scanBudgetMs(): number {
  const raw = Number(process.env.MARKETMIND_SCAN_BUDGET_MS);
  if (Number.isFinite(raw) && raw >= 5_000) return raw;
  return 40_000;
}

const ruleSchema = z.object({
  id: z.string().default(""),
  field: z.string().min(1).max(40),
  operator: z.enum(["gt", "lt", "gte", "lte", "between", "eq"]),
  value: z.number(),
  value2: z.number().optional(),
});

const schema = z.object({
  rules: z.array(ruleSchema).max(12).default([]),
  sectors: z.array(z.string()).max(30).default([]),
  sortBy: z.string().default("technicalScore"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().min(1).max(120).default(50),
  /**
   * How deep to scan. The universe is ~3,150 names and fetching every history
   * on a cold cache cannot finish inside any serverless execution limit, so
   * the caller picks a liquidity-ranked slice instead.
   */
  tier: z.enum(["liquid", "broad", "full", "all"]).default("liquid"),
});

export async function POST(request: Request) {
  const started = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "One or more filters are invalid.", details: parsed.error.issues.slice(0, 4) },
      { status: 400 },
    );
  }

  const { rules, sectors, sortBy, sortDir, limit, tier } = parsed.data;

  const candidates = screenerUniverse(tier, sectors);

  // 2y of daily candles is the minimum for 200-EMA and 52-week metrics.
  //
  // The budget is what keeps a full-universe scan usable. Angel One allows
  // three history requests per second, so 3,000+ cold symbols would take
  // roughly twenty minutes — far beyond any serverless limit. Instead the scan
  // spends 40 seconds, returns everything it managed to read, and leaves the
  // rest cached for the next run. Repeat until `complete` comes back true.
  const { histories, fromCache, fetched, skipped } = await getHistoryBatchBudgeted(
    candidates.map((c) => c.symbol),
    { timeframe: "daily", range: "2y", concurrency: 4, budgetMs: scanBudgetMs() },
  );

  const rows: ScreenerRow[] = [];
  let liveCount = 0;
  let sampleCount = 0;

  for (const entry of candidates) {
    const history = histories.get(entry.symbol);
    // Absent means the budget ran out before this symbol was reached. It is
    // not a failure — the next run picks up where this one stopped.
    if (!history) continue;
    if (history.origin === "live") liveCount += 1;
    else sampleCount += 1;

    const row = buildRow(entry.symbol, entry.name, entry.sector, history.data);
    if (!row) continue;
    if (matchesAll(rules, row.metrics)) rows.push(row);
  }

  rows.sort((a, b) => {
    const av = sortBy === "technicalScore" ? a.technicalScore : (a.metrics[sortBy] ?? -Infinity);
    const bv = sortBy === "technicalScore" ? b.technicalScore : (b.metrics[sortBy] ?? -Infinity);
    const an = Number.isFinite(av as number) ? (av as number) : -Infinity;
    const bn = Number.isFinite(bv as number) ? (bv as number) : -Infinity;
    return sortDir === "desc" ? bn - an : an - bn;
  });

  const origin: DataOrigin = liveCount >= sampleCount ? "live" : "sample";
  const evaluated = histories.size;
  const complete = skipped === 0;

  return NextResponse.json({
    rows: rows.slice(0, limit),
    totalScanned: evaluated,
    universeSize: candidates.length,
    tier,
    tierLabel: SCAN_TIERS[tier].label,
    matched: rows.length,
    origin,
    provider: liveCount > 0 ? ("angelone" as const) : ("sample" as const),
    complete,
    fromCache,
    fetched,
    remaining: skipped,
    notice: buildNotice({ complete, skipped, sampleCount, evaluated }),
    tookMs: Date.now() - started,
  });
}

/**
 * One sentence explaining anything the numbers alone would not convey.
 *
 * An incomplete scan and a scan running on generated data are different
 * situations, and the reader needs to be able to tell them apart at a glance.
 */
function buildNotice({
  complete,
  skipped,
  sampleCount,
  evaluated,
}: {
  complete: boolean;
  skipped: number;
  sampleCount: number;
  evaluated: number;
}): string | undefined {
  const parts: string[] = [];

  if (!complete) {
    parts.push(
      `Read ${evaluated.toLocaleString("en-IN")} stocks before the time budget ran out, with ${skipped.toLocaleString("en-IN")} still to go. Run the scan again to continue — everything already fetched is cached, so each run gets further.`,
    );
  }

  if (sampleCount > 0) {
    parts.push(
      sampleCount === evaluated
        ? "Every result is based on generated sample data because live data was unavailable. Check /api/health for the reason."
        : `${sampleCount.toLocaleString("en-IN")} of ${evaluated.toLocaleString("en-IN")} stocks fell back to generated sample data.`,
    );
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}
