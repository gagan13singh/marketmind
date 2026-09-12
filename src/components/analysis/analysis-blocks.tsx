"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NarrativePoint, SignalGroup, TechnicalAnalysis, TradePlan, Verdict } from "@/types";
import { VERDICT_META } from "@/types";
import { cn } from "@/lib/utils/cn";
import { formatPrice, formatPercent } from "@/lib/utils/format";
import { ScoreBar, VerdictBadge } from "@/components/ui/primitives";

/**
 * The headline call. This is the single element on the page allowed to shout;
 * everything around it stays quiet.
 */
export function VerdictHeader({
  verdict,
  score,
  confidence,
  horizonLabel,
  title,
  subtitle,
}: {
  verdict: Verdict;
  score: number;
  confidence: number;
  horizonLabel: string;
  title: string;
  subtitle?: string;
}) {
  const meta = VERDICT_META[verdict];
  const scoreClass =
    meta.tone === "positive" || meta.tone === "mild-positive"
      ? "bull"
      : meta.tone === "negative" || meta.tone === "mild-negative"
        ? "bear"
        : "flat";

  return (
    <div className="surface-raised p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="label">{horizonLabel}</p>
          <h2 className="mt-1.5 text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--color-paper-dim)]">{subtitle}</p>}
        </div>
        <VerdictBadge verdict={verdict} size="lg" />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-baseline gap-2">
          <span className={cn("metric text-5xl", scoreClass)}>
            {score > 0 ? "+" : ""}
            {score.toFixed(0)}
          </span>
          <span className="text-sm text-[var(--color-paper-faint)]">/ 100</span>
        </div>

        <div className="min-w-0">
          <ScoreBar score={score} height={8} />
          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--color-paper-faint)]">
            <span>
              Signal agreement <span className="metric text-[var(--color-paper-dim)]">{confidence}%</span>
            </span>
            <span>
              {confidence >= 70
                ? "The signal groups broadly agree, which strengthens the call."
                : confidence >= 45
                  ? "Moderate agreement between signal groups."
                  : "The groups disagree, so this call is deliberately pulled toward neutral."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One expandable signal group with all its readings and conclusions. */
export function SignalGroupCard({ group, defaultOpen = false }: { group: SignalGroup; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const toneClass =
    group.direction === "bullish" ? "bull" : group.direction === "bearish" ? "bear" : "flat";

  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--color-ink-800)_50%,transparent)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg">{group.label}</h3>
            <span className={cn("metric text-sm", toneClass)}>
              {group.score > 0 ? "+" : ""}
              {group.score.toFixed(0)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-paper-faint)]">{group.summary}</p>
        </div>

        <div className="hidden w-28 shrink-0 sm:block">
          <ScoreBar score={group.score} />
        </div>

        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-[var(--color-paper-faint)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-[color-mix(in_oklab,var(--color-ink-600)_40%,transparent)]">
          <ul className="divide-y divide-[color-mix(in_oklab,var(--color-ink-700)_50%,transparent)]">
            {group.readings.map((reading) => {
              const readingTone =
                reading.direction === "bullish" ? "bull" : reading.direction === "bearish" ? "bear" : "flat";
              return (
                <li key={reading.key} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm text-[var(--color-paper)]">{reading.label}</span>
                    <span className={cn("metric text-sm", readingTone)}>{reading.display}</span>
                  </div>
                  <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-[var(--color-paper-dim)]">
                    {reading.conclusion}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Entry, stop, targets and position size.
 *
 * Two states, and the difference matters more than anything else on the card.
 * `actionable` means the levels describe a trade that can be taken now.
 * `wait` means the nearest resistance caps the upside below what the stop
 * risks, so the levels describe a trade that becomes valid at a price the
 * stock has not reached — and the card says so plainly instead of printing a
 * ratio below 1:1 and leaving the reader to notice.
 */
export function TradePlanCard({ plan, price }: { plan: TradePlan; price: number }) {
  const waiting = plan.status === "wait";

  return (
    <div className="surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-xl">Mechanical plan</h3>
        <span className="label">Expected hold: {plan.expectedHold}</span>
      </div>

      {waiting ? (
        <span className="chip chip-flat mt-3 inline-block">Wait for entry — not actionable at {formatPrice(price)}</span>
      ) : (
        <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">
          Derived from a {plan.atrPercent.toFixed(2)}% average true range. Levels move with volatility rather than
          being fixed percentages.
        </p>
      )}

      {waiting && plan.wait && (
        <div className="mt-4 rounded-lg border border-[color-mix(in_oklab,var(--color-bear-500)_35%,transparent)] bg-[var(--color-ink-950)] p-4">
          <p className="text-sm leading-relaxed text-[var(--color-paper-dim)]">{plan.wait.reason}</p>
          <ol className="mt-3 space-y-2.5">
            {plan.wait.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--color-paper-dim)]">
                <span className="metric shrink-0 text-xs text-[var(--color-paper-faint)]">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <PlanCell
          label={waiting ? "Planned entry" : "Entry band"}
          value={`${formatPrice(plan.entryLow)} – ${formatPrice(plan.entryHigh)}`}
          note={
            waiting
              ? `${(((price - plan.entryLow) / price) * 100).toFixed(1)}% below today — a limit, not a market order`
              : "Around current price, not a chase"
          }
        />
        <PlanCell
          label="Stop loss"
          value={formatPrice(plan.stopLoss)}
          note={`${plan.stopPercent.toFixed(1)}% away · ${plan.stopBasis}`}
          tone="bear"
        />
        <PlanCell
          label="Risk / reward"
          value={`1 : ${plan.riskRewardRatio.toFixed(1)}`}
          note={waiting ? "At the planned entry, not today's price" : "To the first target"}
          tone="accent"
        />
      </div>

      {plan.targets.length > 0 ? (
        <div className="mt-5">
          <div className="label mb-2">
            Targets{waiting ? " — from the planned entry" : ""}
            {plan.totalUpsidePercent > 0 && (
              <span className="ml-2 text-[var(--color-paper-faint)]">
                full ladder {formatPercent(plan.totalUpsidePercent, 0)}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {plan.targets.map((t) => (
              <div key={t.label} className="rounded-lg border border-[var(--color-ink-700)] px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-[var(--color-paper-dim)]">{t.label}</span>
                  <div className="flex items-baseline gap-4">
                    <span className="metric text-sm bull">{formatPrice(t.price)}</span>
                    <span className="metric w-14 text-right text-xs text-[var(--color-paper-faint)]">
                      {t.rMultiple.toFixed(1)}R
                    </span>
                    <span className="metric w-16 text-right text-xs bull">{formatPercent(t.gainPercent, 1)}</span>
                  </div>
                </div>
                {t.basis && <p className="mt-1 text-xs text-[var(--color-paper-faint)]">{t.basis}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm leading-relaxed text-[var(--color-paper-dim)]">
          No target ladder is published here. Every level that would clear the risk sits above resistance that has not
          broken, so any ladder drawn from today&rsquo;s price would be a projection through a wall rather than a plan.
        </p>
      )}

      {plan.rewardNote && (
        <p className="mt-4 rounded-lg border border-[var(--color-ink-700)] p-3.5 text-sm leading-relaxed text-[var(--color-paper-dim)]">
          {plan.rewardNote}
        </p>
      )}

      {plan.positionSizeExample.shares > 0 && (
        <div className="mt-5 rounded-lg border border-[var(--color-ink-700)] bg-[var(--color-ink-950)] p-4">
          <div className="label">Position sizing example</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-paper-dim)]">
            On a {formatPrice(plan.positionSizeExample.accountSize)} account risking{" "}
            {plan.positionSizeExample.riskPercent}% per trade, {waiting ? "the planned" : "the"} stop distance implies{" "}
            <span className="metric text-[var(--color-paper)]">{plan.positionSizeExample.shares} shares</span> —{" "}
            {formatPrice(plan.positionSizeExample.capitalRequired)} of capital. Size falls automatically as volatility
            rises, which is what keeps risk constant across different stocks.
          </p>
        </div>
      )}

      <p className="mt-4 text-xs text-[var(--color-paper-faint)]">
        Current price {formatPrice(price)}. These levels are generated from price data alone and take no account of
        upcoming earnings, corporate actions or your own position.
      </p>
    </div>
  );
}

function PlanCell({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "bull" | "bear" | "accent";
}) {
  const toneClass = tone === "bull" ? "bull" : tone === "bear" ? "bear" : tone === "accent" ? "text-[var(--color-signal-400)]" : "";
  return (
    <div>
      <div className="label">{label}</div>
      <div className={cn("metric mt-1 text-base", toneClass)}>{value}</div>
      <div className="mt-0.5 text-xs text-[var(--color-paper-faint)]">{note}</div>
    </div>
  );
}

/**
 * Narrative, key points and risks.
 *
 * When `points` is supplied the summary renders as labelled rows rather than a
 * paragraph. The paragraph form ran to about 900 characters of unbroken prose,
 * which is more than anyone reads on a page they are scanning for a price, so
 * the label column is the important part: a reader who only wants the trade
 * plan can find it without reading the trend read first.
 */
export function NarrativeBlock({
  narrative,
  points,
  keyPoints,
  risks,
}: {
  narrative: string;
  points?: NarrativePoint[];
  keyPoints: string[];
  risks: string[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="surface p-6">
        <h3 className="text-xl">What this adds up to</h3>

        {points && points.length > 0 ? (
          <ul className="mt-5 space-y-4">
            {points.map((point) => (
              <li key={point.label} className="grid gap-x-4 gap-y-1 sm:grid-cols-[8.5rem_1fr]">
                <div className="flex items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      point.tone === "bullish"
                        ? "bg-[var(--color-bull-500)]"
                        : point.tone === "bearish"
                          ? "bg-[var(--color-bear-500)]"
                          : "bg-[var(--color-flat-500)]",
                    )}
                  />
                  <span className="text-sm text-[var(--color-paper)]">{point.label}</span>
                </div>
                <p className="max-w-[62ch] text-sm leading-relaxed text-[var(--color-paper-dim)]">{point.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="narrative mt-4">{narrative}</p>
        )}
      </div>

      <div className="space-y-5">
        <div className="surface p-5">
          <h3 className="text-lg">Key readings</h3>
          <ul className="mt-3 space-y-2">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-[var(--color-paper-dim)]">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--color-signal-500)]" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="surface p-5">
          <h3 className="text-lg">What could go wrong</h3>
          <ul className="mt-3 space-y-3">
            {risks.map((risk, i) => (
              <li key={i} className="text-sm leading-relaxed text-[var(--color-paper-dim)]">
                {risk}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Support and resistance levels drawn from clustered swing pivots. */
export function LevelsCard({ structure, price }: { structure: TechnicalAnalysis["structure"]; price: number }) {
  const rows = [
    ...structure.resistances.slice().reverse().map((l) => ({ ...l, kind: "resistance" as const })),
    ...structure.supports.map((l) => ({ ...l, kind: "support" as const })),
  ];

  return (
    <div className="surface p-5">
      <h3 className="text-xl">Support and resistance</h3>
      <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">
        Clustered from confirmed swing pivots, then scored on how often price reacted there and how recently.
      </p>

      <div className="mt-4 space-y-1.5">
        {rows.length === 0 && (
          <p className="py-4 text-sm text-[var(--color-paper-faint)]">
            Not enough confirmed swing pivots in this window to identify reliable levels.
          </p>
        )}
        {rows.map((level, i) => {
          const distance = ((level.price - price) / price) * 100;
          return (
            <div
              key={`${level.kind}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-ink-700)] px-3.5 py-2.5"
            >
              <span className={cn("chip", level.kind === "support" ? "chip-bull" : "chip-bear")}>
                {level.kind === "support" ? "Support" : "Resistance"}
              </span>
              <span className="metric flex-1 text-sm">{formatPrice(level.price)}</span>
              <span className="metric w-16 text-right text-xs text-[var(--color-paper-faint)]">
                {formatPercent(distance, 1)}
              </span>
              <span className="hidden w-24 shrink-0 sm:block">
                <span className="label">{level.touches} touches</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-[var(--color-ink-700)] pt-4">
        <div>
          <div className="label">52-week position</div>
          <div className="metric mt-1 text-base">{structure.fiftyTwoWeekPosition.toFixed(0)}%</div>
        </div>
        <div>
          <div className="label">From high</div>
          <div className="metric mt-1 text-base bear">{formatPercent(structure.distanceFromHigh, 1)}</div>
        </div>
        <div>
          <div className="label">From low</div>
          <div className="metric mt-1 text-base bull">{formatPercent(structure.distanceFromLow, 1)}</div>
        </div>
      </div>
    </div>
  );
}
