import { NextResponse } from "next/server";
import { z } from "zod";
import { search } from "@/lib/data/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  q: z.string().min(1).max(60),
  limit: z.coerce.number().int().min(1).max(25).default(12),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? 12,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a symbol or company name to search." }, { status: 400 });
  }

  const result = await search(parsed.data.q, parsed.data.limit);
  return NextResponse.json(result);
}
