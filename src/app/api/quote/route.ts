import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuote } from "@/lib/data/service";

export const runtime = "nodejs";
export const revalidate = 300;

const schema = z.object({ symbol: z.string().min(1).max(30) });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({ symbol: url.searchParams.get("symbol") ?? "" });

  if (!parsed.success) {
    return NextResponse.json({ error: "A symbol is required." }, { status: 400 });
  }

  const result = await getQuote(parsed.data.symbol);
  return NextResponse.json(result);
}
