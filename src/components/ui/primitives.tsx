import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { DataOrigin, DataProvider, SignalDirection, Verdict } from "@/types";
import { VERDICT_META } from "@/types";
import { formatShortDate } from "@/lib/utils/format";

/** Verdict pill. Uses data colours because a verdict IS data. */
export function VerdictBadge({ verdict, size = "md" }: { verdict: Verdict; size?: "sm" | "md" | "lg" }) {
  const meta = VERDICT_META[verdict];
  const tone =
    meta.tone === "positive" || meta.tone === "mild-positive"
      ? "chip-bull"
      : meta.tone === "negative" || meta.tone === "mild-negative"
        ? "chip-bear"
        : "chip-flat";
  const sizing =
    size === "lg" ? "text-base px-4 py-1.5" : size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  return <span className={cn("chip", tone, sizing, "font-medium")}>{meta.label}</span>;
}

export function DirectionChip({ direction, children }: { direction: SignalDirection; children: ReactNode }) {
  const tone = direction === "bullish" ? "chip-bull" : direction === "bearish" ? "chip-bear" : "chip-flat";
  return <span className={cn("chip", tone)}>{children}</span>;
}

/**
 * Score meter, -100..+100. The zero point is marked so the reader can see
 * which side of neutral a score sits on at a glance.
 */
export function ScoreBar({ score, height = 6 }: { score: number; height?: number }) {
  const clamped = Math.max(-100, Math.min(100, score));
  const width = Math.abs(clamped) / 2;
  const isPositive = clamped >= 0;
  return (
    <div className="relative w-full rounded-full bg-[var(--color-ink-700)]" style={{ height }}>
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--color-ink-600)]" />
      <div
        className="absolute top-0 h-full rounded-full transition-all duration-500"
        style={{
          width: `${width}%`,
          left: isPositive ? "50%" : `${50 - width}%`,
          background: isPositive ? "var(--color-bull-500)" : "var(--color-bear-500)",
        }}
      />
    </div>
  );
}

const PROVIDER_LABEL: Record<DataProvider, string> = {
  angelone: "Angel One",
  yahoo: "Yahoo Finance",
  sample: "generated",
};

/**
 * Tells the reader whether they are looking at real prices or generated ones,
 * which upstream served them, and how fresh the last candle is.
 *
 * Everything shown here is derived from props the server already computed.
 * Nothing calls `new Date()` during render: doing so produced a different
 * string on the server than in the browser, which is exactly what React was
 * warning about on hydration.
 */
export function OriginBadge({
  origin,
  provider,
  asOf,
  notice,
}: {
  origin: DataOrigin;
  provider?: DataProvider;
  asOf?: string;
  notice?: string;
}) {
  if (origin === "live") {
    const source = provider ? PROVIDER_LABEL[provider] : "market data";
    return (
      <span
        className="chip chip-flat"
        title={`Live end-of-day data from ${source}${asOf ? `, last close ${formatShortDate(asOf)}` : ""}`}
      >
        <span className="size-1.5 rounded-full bg-[var(--color-bull-500)] animate-pulse-soft" />
        Live
        {asOf && <span className="text-[var(--color-paper-faint)]">· {formatShortDate(asOf)}</span>}
      </span>
    );
  }

  return (
    <span
      className="chip chip-accent"
      title={notice ?? "Generated sample data — not real prices."}
    >
      <span className="size-1.5 rounded-full bg-[var(--color-signal-500)]" />
      Sample data
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  raised = false,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  return (
    <section className={cn(raised ? "surface-raised" : "surface", "overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="min-w-0">
            {title && <h2 className="text-xl text-[var(--color-paper)]">{title}</h2>}
            {subtitle && <p className="label mt-1 max-w-prose">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(title || action ? "px-5 pb-5" : "p-5")}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear" | "flat" | "accent";
  hint?: string;
}) {
  const toneClass =
    tone === "bull" ? "bull" : tone === "bear" ? "bear" : tone === "accent" ? "text-[var(--color-signal-400)]" : "";
  return (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className={cn("metric mt-1 text-lg", toneClass)}>{value}</div>
      {hint && <div className="label mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h3 className="text-xl">{title}</h3>
      <p className="max-w-md text-sm text-[var(--color-paper-dim)]">{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}

/** Not investment advice. Shown wherever the product makes a call. */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-[var(--color-paper-faint)]", className)}>
      MarketMind is an analysis tool, not an investment adviser. Everything here is generated from historical price and
      filing data by a rules engine, and none of it accounts for your circumstances, goals or risk tolerance. Markets can
      move against any analysis. Do your own research and consider speaking to a SEBI-registered adviser before acting.
    </p>
  );
}
