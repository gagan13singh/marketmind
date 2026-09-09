import { NextResponse } from "next/server";
import { z } from "zod";
import { getHistory } from "@/lib/data/service";
import { TIMEFRAMES } from "@/types";

export const runtime = "nodejs";
export const revalidate = 600;

const schema = z.object({
  symbol: z.string().min(1).max(30),
  // Intraday intervals are deliberately not accepted.
  timeframe: z.enum(TIMEFRAMES).default("daily"),
  range: z.enum(["1y", "2y", "5y", "10y"]).default("5y"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    symbol: url.searchParams.get("symbol") ?? "",
    timeframe: url.searchParams.get("timeframe") ?? "daily",
    range: url.searchParams.get("range") ?? "5y",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a symbol, and a timeframe of daily, weekly or monthly." },
      { status: 400 },
    );
  }

  const { symbol, timeframe, range } = parsed.data;
  const result = await getHistory(symbol, timeframe, range);
  return NextResponse.json(result);
}
