import { NextResponse } from "next/server";
import { getHistory } from "@/lib/data/service";
import {
  angelRawQuote,
  fetchAngelHistory,
  fetchAngelTodayBars,
  istNow,
  todaySessionOpen,
  withTodayBar,
  type TodayBarReport,
} from "@/lib/data/angel";
import { resolveInstrument } from "@/lib/data/angel/instruments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Why is the last candle not today's?
 *
 * The top-up that rebuilds today's bar from the live quote fails soft by
 * design — settled history is still usable without it — which means a failure
 * shows up only as a chart quietly stuck on yesterday. This endpoint makes
 * every step of that path visible: what the settled feed returned, what the
 * quote endpoint returned verbatim, whether the two could be matched, and what
 * the merge decided.
 *
 * Usage: /api/diagnose?symbol=RELIANCE.NS
 */

const ist = (ms: number) => new Date(ms + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "RELIANCE.NS").toUpperCase();

  const now = istNow();
  const instrument = await resolveInstrument(symbol);

  // 1. What does the settled historical feed actually end at?
  const settled = await fetchAngelHistory(symbol, "1y");
  const tail = (settled.candles ?? []).slice(-4).map((c) => ({
    date: ist(c.time),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  // 2. What does the quote endpoint return, verbatim and unparsed?
  const raw = await angelRawQuote(symbol);

  // 3. Could it be matched back, and what did the merge decide?
  const report = { value: undefined as unknown as TodayBarReport };
  const bars = await fetchAngelTodayBars([symbol], report);
  const today = bars.get(symbol);

  const merged = withTodayBar(settled.candles ?? [], today);
  const settledLast = (settled.candles ?? []).at(-1);
  const mergedLast = merged.at(-1);

  // 4. What does the app actually serve?
  const served = await getHistory(symbol, "daily", "1y");

  return NextResponse.json(
    {
      symbol,
      serverTimeIst: `${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")} (weekday ${now.weekday}, ${Math.floor(now.minutesIntoDay / 60)}:${String(now.minutesIntoDay % 60).padStart(2, "0")})`,
      instrument: instrument
        ? { token: instrument.token, tradingSymbol: instrument.tradingSymbol, kind: instrument.kind }
        : null,

      settledFeed: {
        bars: settled.candles?.length ?? 0,
        lastDate: settledLast ? ist(settledLast.time) : null,
        failureReason: settled.reason ?? null,
        failureMessage: settled.message ?? null,
        tail,
      },

      quoteEndpoint: {
        ok: raw.ok,
        message: raw.message,
        // Verbatim, so a key named differently than expected is immediately
        // obvious rather than being read as undefined.
        rawFirstRow: raw.row ?? null,
        keysReturned: raw.row ? Object.keys(raw.row) : [],
      },

      topUp: {
        report: report.value ?? null,
        rebuiltBar: today
          ? { date: ist(today.time), open: today.open, high: today.high, low: today.low, close: today.close, volume: today.volume }
          : null,
        expectedTodayDate: ist(todaySessionOpen()),
        applied: mergedLast !== settledLast,
        mergedLastDate: mergedLast ? ist(mergedLast.time) : null,
      },

      served: {
        origin: served.origin,
        provider: served.provider ?? null,
        asOf: served.asOf ?? null,
        bars: served.data.length,
      },

      verdict: verdict({
        settledDate: settledLast ? ist(settledLast.time) : null,
        rebuilt: today ? ist(today.time) : null,
        servedAsOf: served.asOf ?? null,
        expected: ist(todaySessionOpen()),
        report: report.value,
        quoteOk: raw.ok,
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function verdict({
  settledDate,
  rebuilt,
  servedAsOf,
  expected,
  report,
  quoteOk,
}: {
  settledDate: string | null;
  rebuilt: string | null;
  servedAsOf: string | null;
  expected: string;
  report?: TodayBarReport;
  quoteOk: boolean;
}): string {
  if (servedAsOf === expected) {
    return `Working. The app is serving ${servedAsOf}, which is the current session.`;
  }
  if (settledDate === expected) {
    return `Angel One's settled feed already includes ${expected}; no top-up was needed.`;
  }
  if (!quoteOk) {
    return `The quote endpoint is failing, so today's bar cannot be rebuilt. Settled history ends at ${settledDate}. See quoteEndpoint.message.`;
  }
  if (!rebuilt) {
    return `The quote endpoint answered but no bar could be built from it: ${report?.skippedReason ?? "unknown reason"}. Compare quoteEndpoint.keysReturned against the field names the parser looks for.`;
  }
  if (rebuilt !== expected) {
    return `The quote endpoint is reporting the ${rebuilt} session, not ${expected}. The exchange has not published a newer bar yet — this is upstream data, not a bug in the app.`;
  }
  return `A bar for ${rebuilt} was rebuilt but the served history says ${servedAsOf}. Likely a cached render; hard-reload or redeploy.`;
}
