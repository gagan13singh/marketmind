import { NextResponse } from "next/server";
import { z } from "zod";
import { getHistory } from "@/lib/data/service";
import { runBacktest } from "@/lib/backtest";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  symbol: z.string().min(1).max(30),
  strategy: z.enum([
    "ema-crossover",
    "golden-cross",
    "supertrend",
    "rsi-pullback",
    "breakout-52w",
    "macd-trend",
    "bollinger-reversion",
  ]),
  params: z.record(z.string(), z.number()).default({}),
  range: z.enum(["2y", "5y", "10y"]).default("5y"),
  initialCapital: z.number().min(1000).max(100_000_000).default(100_000),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the strategy name and parameters.", details: parsed.error.issues.slice(0, 4) },
      { status: 400 },
    );
  }

  const { symbol, strategy, params, range, initialCapital } = parsed.data;
  const history = await getHistory(symbol, "daily", range);
  const result = runBacktest(symbol, history.data, strategy, params, initialCapital);

  if (!result) {
    return NextResponse.json(
      { error: "Not enough price history to backtest this symbol. Try a longer range or a more liquid stock." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ...result,
    origin: history.origin,
    provider: history.provider,
    asOf: history.asOf,
    notice: history.notice,
  });
}
