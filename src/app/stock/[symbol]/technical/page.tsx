import type { Metadata } from "next";
import { getHistory, getQuote } from "@/lib/data/service";
import { analyzeTechnical } from "@/lib/analysis/technical";
import { normalizeSymbol, displaySymbol } from "@/lib/data/symbols";
import { AppNav, AppFooter } from "@/components/layout/app-nav";
import { StockHeader } from "@/components/layout/stock-header";
import { Disclaimer, EmptyState } from "@/components/ui/primitives";
import { TechnicalWorkspace } from "@/components/analysis/technical-workspace";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  const clean = displaySymbol(normalizeSymbol(decodeURIComponent(symbol)));
  return { title: `${clean} technical analysis` };
}

export default async function TechnicalPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = normalizeSymbol(decodeURIComponent(raw));

  const [quote, history] = await Promise.all([getQuote(symbol), getHistory(symbol, "daily", "5y")]);

  // Pre-compute both horizons on the server so switching is instant.
  const swing = analyzeTechnical(symbol, history.data, "swing", "daily");
  const positionalWeekly = analyzeTechnical(symbol, history.data, "positional", "weekly");
  const positionalMonthly = analyzeTechnical(symbol, history.data, "positional", "monthly");
  const swingWeekly = analyzeTechnical(symbol, history.data, "swing", "weekly");

  return (
    <>
      <AppNav />
      <StockHeader
        quote={quote.data}
        origin={quote.origin}
        provider={quote.provider}
        asOf={history.asOf ?? quote.asOf}
        notice={quote.notice}
      />

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        {!swing ? (
          <EmptyState
            title="Not enough price history"
            description="A reliable technical read needs at least 60 daily candles. This symbol does not have them."
          />
        ) : (
          <>
            <TechnicalWorkspace
              candles={history.data}
              analyses={{
                "swing-daily": swing,
                "swing-weekly": swingWeekly,
                "positional-weekly": positionalWeekly,
                "positional-monthly": positionalMonthly,
              }}
            />
            <Disclaimer className="mt-10 max-w-3xl" />
          </>
        )}
      </main>

      <AppFooter />
    </>
  );
}
