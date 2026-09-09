import { NextResponse } from "next/server";
import { z } from "zod";
import { getHistory } from "@/lib/data/service";
import { analyzeTechnical } from "@/lib/analysis/technical";
import { HORIZONS, TIMEFRAMES } from "@/types";

export const runtime = "nodejs";
export const revalidate = 600;

const schema = z.object({
  symbol: z.string().min(1).max(30),
  horizon: z.enum(HORIZONS).default("swing"),
  timeframe: z.enum(TIMEFRAMES).default("daily"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    symbol: url.searchParams.get("symbol") ?? "",
    horizon: url.searchParams.get("horizon") ?? "swing",
    timeframe: url.searchParams.get("timeframe") ?? "daily",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a symbol, a horizon of swing or positional, and a daily, weekly or monthly timeframe." },
      { status: 400 },
    );
  }

  const { symbol, horizon, timeframe } = parsed.data;
  const history = await getHistory(symbol, "daily", "5y");
  const analysis = analyzeTechnical(symbol, history.data, horizon, timeframe);

  if (!analysis) {
    return NextResponse.json(
      { error: "Not enough price history for this symbol to run a reliable analysis." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    data: analysis,
    origin: history.origin,
    notice: history.notice,
    fetchedAt: history.fetchedAt,
  });
}
