"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Quote, DataOrigin, DataProvider } from "@/types";
import { cn } from "@/lib/utils/cn";
import { formatPrice, formatPercent, formatCompact, directionClass } from "@/lib/utils/format";
import { OriginBadge } from "@/components/ui/primitives";
import { displaySymbol } from "@/lib/data/symbols";

/**
 * Shared header across a stock's overview, technical and fundamental pages.
 *
 * Layout note: the name and the price are stacked on a phone and only sit
 * side by side from `sm` up. Right-aligning the price against a
 * `justify-between` row meant a long company name — "Samvardhana Motherson
 * International" — ran straight into it at 360px.
 */
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
    <div className="border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--color-ink-950)_35%,transparent)]">
      <div className="shell pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="min-w-0 text-2xl sm:text-3xl">{quote.name}</h1>
              <OriginBadge origin={origin} provider={provider} asOf={asOf} notice={notice} />
            </div>
            <p className="metric mt-1.5 truncate text-sm text-[var(--color-paper-faint)]">
              {displaySymbol(quote.symbol)} · {quote.exchange}
              {quote.sector ? ` · ${quote.sector}` : ""}
            </p>
          </div>

          <div className="shrink-0 sm:text-right">
            <div className="metric text-3xl leading-none">{formatPrice(quote.price)}</div>
            <div className={cn("metric mt-2 text-sm", tone)}>
              {formatPrice(quote.change)} ({formatPercent(quote.changePercent)})
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Day range", value: `${formatPrice(quote.dayLow)} – ${formatPrice(quote.dayHigh)}` },
            {
              label: "52-week range",
              value: `${formatPrice(quote.fiftyTwoWeekLow)} – ${formatPrice(quote.fiftyTwoWeekHigh)}`,
            },
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

        {/* The mask tells the reader there is more to the right rather than
            cutting a tab off mid-word with no explanation. */}
        <div
          className="no-scrollbar mt-6 overflow-x-auto"
          style={{
            maskImage: "linear-gradient(90deg, #000 0, #000 92%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(90deg, #000 0, #000 92%, transparent 100%)",
          }}
        >
          <nav className="flex min-w-max gap-1" aria-label="Analysis sections">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors duration-200",
                    isActive
                      ? "border-[var(--color-signal-500)] text-[var(--color-paper)]"
                      : "border-transparent text-[var(--color-paper-faint)] hover:border-[var(--color-ink-600)] hover:text-[var(--color-paper-dim)]",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
