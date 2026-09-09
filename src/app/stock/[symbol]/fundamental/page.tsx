import type { Metadata } from "next";
import { getFundamentals, getQuote } from "@/lib/data/service";
import { analyzeFundamental } from "@/lib/analysis/fundamental";
import { normalizeSymbol, displaySymbol } from "@/lib/data/symbols";
import { AppNav, AppFooter } from "@/components/layout/app-nav";
import { StockHeader } from "@/components/layout/stock-header";
import { Disclaimer } from "@/components/ui/primitives";
import { VerdictHeader, SignalGroupCard, NarrativeBlock } from "@/components/analysis/analysis-blocks";
import { FinancialStatements } from "@/components/analysis/financial-statements";
import { formatPercent, formatNumber } from "@/lib/utils/format";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  const clean = displaySymbol(normalizeSymbol(decodeURIComponent(symbol)));
  return { title: `${clean} fundamental analysis` };
}

export default async function FundamentalPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = normalizeSymbol(decodeURIComponent(raw));

  const [quote, fundamentals] = await Promise.all([getQuote(symbol), getFundamentals(symbol)]);
  const snapshot = fundamentals.data;
  const analysis = analyzeFundamental(snapshot);

  const headline = [
    { label: "Return on equity", value: formatPercent(snapshot.ratios.roe, 1, false) },
    { label: "Return on capital", value: formatPercent(snapshot.ratios.roce, 1, false) },
    { label: "Debt to equity", value: formatNumber(snapshot.ratios.debtToEquity, 2) },
    { label: "Net margin", value: formatPercent(snapshot.ratios.netMargin, 1, false) },
    { label: "Revenue CAGR (3Y)", value: formatPercent(snapshot.growth.revenueCagr3y, 1) },
    { label: "Profit CAGR (3Y)", value: formatPercent(snapshot.growth.profitCagr3y, 1) },
    { label: "P/E", value: formatNumber(snapshot.valuation.peRatio, 1) },
    { label: "Price to book", value: formatNumber(snapshot.valuation.priceToBook, 2) },
  ];

  return (
    <>
      <AppNav />
      <StockHeader
        quote={quote.data}
        origin={fundamentals.origin}
        provider={fundamentals.provider}
        asOf={quote.asOf}
        notice={fundamentals.notice}
      />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-6">
        <VerdictHeader
          verdict={analysis.verdict}
          score={analysis.compositeScore}
          confidence={analysis.confidence}
          horizonLabel="Positional · business quality"
          title={`${analysis.qualityTier.charAt(0).toUpperCase() + analysis.qualityTier.slice(1)} quality business`}
          subtitle={`Scored across ${analysis.groups.length} areas of the financials, from ${snapshot.annual.length} years of statements.`}
        />

        <section className="surface p-5">
          <h2 className="text-lg">At a glance</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {headline.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="label truncate">{item.label}</dt>
                <dd className="metric mt-1 text-lg">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <NarrativeBlock narrative={analysis.narrative} keyPoints={analysis.keyPoints} risks={analysis.risks} />

        <section>
          <h2 className="text-2xl">The financials</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-paper-dim)]">
            Five years of statements as reported. Missing figures show as a dash rather than a zero, because an absent
            number and a zero mean very different things.
          </p>
          <div className="mt-5">
            <FinancialStatements snapshot={snapshot} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Every metric, and what it means</h2>
          <p className="max-w-2xl text-sm text-[var(--color-paper-dim)]">
            Profitability and cash flow carry the most weight, because return on capital and earnings quality are what
            actually determine long-term outcomes. Valuation is weighted lowest — a cheap bad business rarely works out.
          </p>
          <div className="space-y-3 pt-2">
            {analysis.groups.map((group, i) => (
              <SignalGroupCard key={group.key} group={group} defaultOpen={i === 0} />
            ))}
          </div>
        </section>

        <Disclaimer className="max-w-3xl" />
      </main>

      <AppFooter />
    </>
  );
}
