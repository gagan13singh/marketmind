"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Quote, DataOrigin, DataProvider } from "@/types";
import { cn } from "@/lib/utils/cn";
import { formatPrice, formatPercent, formatCompact, directionClass } from "@/lib/utils/format";
import { OriginBadge } from "@/components/ui/primitives";
import { displaySymbol } from "@/lib/data/symbols";

/** Shared header across a stock's overview, technical and fundamental pages. */
export function StockHeader({
  quote,
  origin,
  provider,
  asOf,
  notice,
}: {
  quote: Quote;
  origin: DataOrigin;
  provider?: DataProvider;
  asOf?: string;
  notice?: string;
}) {
  const pathname = usePathname();
  const base = `/stock/${encodeURIComponent(quote.symbol)}`;

  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/technical`, label: "Technical" },
    { href: `${base}/fundamental`, label: "Fundamental" },
  ];

  const tone = directionClass(quote.change);

  return (
    <div className="border-b border-[color-mix(in_oklab,var(--color-ink-600)_40%,transparent)]">
      <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl">{quote.name}</h1>
              <OriginBadge origin={origin} provider={provider} asOf={asOf} notice={notice} />
            </div>
            <p className="metric mt-1.5 text-sm text-[var(--color-paper-faint)]">
              {displaySymbol(quote.symbol)} · {quote.exchange}
              {quote.sector ? ` · ${quote.sector}` : ""}
            </p>
          </div>

          <div className="text-right">
            <div className="metric text-3xl">{formatPrice(quote.price)}</div>
            <div className={cn("metric mt-1 text-sm", tone)}>
              {formatPrice(quote.change)} ({formatPercent(quote.changePercent)})
            </div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: "Day range", value: `${formatPrice(quote.dayLow)} – ${formatPrice(quote.dayHigh)}` },
            { label: "52-week range", value: `${formatPrice(quote.fiftyTwoWeekLow)} – ${formatPrice(quote.fiftyTwoWeekHigh)}` },
            { label: "Volume", value: formatCompact(quote.volume) },
            { label: "Avg volume", value: formatCompact(quote.averageVolume) },
            { label: "Market cap", value: quote.marketCap ? `₹${formatCompact(quote.marketCap)}` : "—" },
            { label: "P/E", value: quote.peRatio ? quote.peRatio.toFixed(1) : "—" },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="label truncate">{item.label}</dt>
              <dd className="metric mt-0.5 truncate text-sm">{item.value}</dd>
            </div>
          ))}
        </dl>

        <nav className="mt-6 flex gap-1 overflow-x-auto no-scrollbar" aria-label="Analysis sections">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
                  isActive
                    ? "border-[var(--color-signal-500)] text-[var(--color-paper)]"
                    : "border-transparent text-[var(--color-paper-faint)] hover:text-[var(--color-paper-dim)]",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
