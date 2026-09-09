import { NextResponse } from "next/server";
import { z } from "zod";
import { getFundamentals } from "@/lib/data/service";
import { analyzeFundamental } from "@/lib/analysis/fundamental";

export const runtime = "nodejs";
export const revalidate = 3600;

const schema = z.object({ symbol: z.string().min(1).max(30) });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({ symbol: url.searchParams.get("symbol") ?? "" });

  if (!parsed.success) {
    return NextResponse.json({ error: "A symbol is required." }, { status: 400 });
  }

  const snapshot = await getFundamentals(parsed.data.symbol);
  const analysis = analyzeFundamental(snapshot.data);

  return NextResponse.json({
    data: analysis,
    snapshot: snapshot.data,
    origin: snapshot.origin,
    notice: snapshot.notice,
    fetchedAt: snapshot.fetchedAt,
  });
}
