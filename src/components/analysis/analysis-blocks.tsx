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
    <div className="surface-raised animate-fade-up p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 sm:gap-6">
        <div className="min-w-0">
          <p className="label">{horizonLabel}</p>
          <h2 className="mt-1.5 text-xl sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--color-paper-dim)]">{subtitle}</p>}
        </div>
        <VerdictBadge verdict={verdict} size="lg" />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6">
        <div className="flex items-baseline gap-2">
          <span className={cn("metric text-4xl sm:text-5xl", scoreClass)}>
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
  const toneClass = group.direction === "bullish" ? "bull" : group.direction === "bearish" ? "bear" : "flat";

  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--color-ink-800)_55%,transparent)] sm:gap-4 sm:px-5 sm:py-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <h3 className="truncate text-base sm:text-lg">{group.label}</h3>
            <span className={cn("metric shrink-0 text-sm", toneClass)}>
              {group.score > 0 ? "+" : ""}
              {group.score.toFixed(0)}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-[var(--color-paper-faint)] sm:whitespace-normal">
            {group.summary}
          </p>
        </div>

        <div className="hidden w-24 shrink-0 sm:block lg:w-28">
          <ScoreBar score={group.score} />
        </div>

        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-[var(--color-paper-faint)] transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden border-t border-[color-mix(in_oklab,var(--color-ink-600)_40%,transparent)]">
          <ul className="divide-y divide-[color-mix(in_oklab,var(--color-ink-700)_50%,transparent)]">
            {group.readings.map((reading, i) => {
              const readingTone =
                reading.direction === "bullish" ? "bull" : reading.direction === "bearish" ? "bear" : "flat";
              return (
                <li
                  key={reading.key}
                  className={cn("px-4 py-3.5 sm:px-5 sm:py-4", open && `animate-fade-in stagger-${Math.min(i + 1, 6)}`)}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="min-w-0 text-sm text-[var(--color-paper)]">{reading.label}</span>
                    <span className={cn("metric shrink-0 text-sm", readingTone)}>{reading.display}</span>
                  </div>
                  <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-[var(--color-paper-dim)]">
                    {reading.conclusion}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
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
 *
 * Layout note on the target rows: price, R-multiple and % gain are grouped
 * into ONE flex child rather than three independent fixed-width siblings.
 * That child wraps as a whole beneath the label on a narrow screen, which is
 * what stops the numbers overlapping at 360px — the failure mode of the
 * previous version, where three `w-*` columns simply ran out of room.
 */
export function TradePlanCard({ plan, price }: { plan: TradePlan; price: number }) {
  const waiting = plan.status === "wait";

  return (
    <div className="surface animate-fade-up p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-lg sm:text-xl">Mechanical plan</h3>
        <span className="label">Expected hold: {plan.expectedHold}</span>
      </div>

      {waiting ? (
        <span className="chip chip-flat mt-3 inline-block">
          Wait for entry — not actionable at {formatPrice(price)}
        </span>
      ) : (
        <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">
          Derived from a {plan.atrPercent.toFixed(2)}% average true range. Levels move with volatility
          rather than being fixed percentages.
        </p>
      )}

      {waiting && plan.wait && (
        <div className="mt-4 rounded-xl border border-[color-mix(in_oklab,var(--color-bear-500)_35%,transparent)] bg-[var(--color-ink-950)] p-3.5 sm:p-4">
          <p className="text-sm leading-relaxed text-[var(--color-paper-dim)]">{plan.wait.reason}</p>
          <ol className="mt-3 space-y-2.5">
            {plan.wait.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--color-paper-dim)]">
                <span className="metric mt-0.5 shrink-0 text-xs text-[var(--color-paper-faint)]">{i + 1}</span>
                <span className="min-w-0">{step}</span>
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
          <div className="label mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span>Targets{waiting ? " — from the planned entry" : ""}</span>
            {plan.totalUpsidePercent > 0 && (
              <span className="text-[var(--color-paper-faint)]">
                full ladder {formatPercent(plan.totalUpsidePercent, 0)}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {plan.targets.map((t, i) => (
              <div
                key={t.label}
                className={cn(
                  "animate-fade-up rounded-xl border border-[var(--color-ink-700)] px-3.5 py-3 transition-colors duration-150 hover:border-[var(--line-gold)]",
                  `stagger-${Math.min(i + 1, 6)}`,
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                  <span className="min-w-0 text-sm text-[var(--color-paper-dim)]">{t.label}</span>
                  {/* Grouped so the three values wrap together, never apart. */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="metric bull text-sm">{formatPrice(t.price)}</span>
                    <span className="metric text-xs text-[var(--color-paper-faint)]">
                      {t.rMultiple.toFixed(1)}R
                    </span>
                    <span className="metric bull text-xs">{formatPercent(t.gainPercent, 1)}</span>
                  </div>
                </div>
                {t.basis && <p className="mt-1.5 text-xs text-[var(--color-paper-faint)]">{t.basis}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm leading-relaxed text-[var(--color-paper-dim)]">
          No target ladder is published here. Every level that would clear the risk sits above
          resistance that has not broken, so any ladder drawn from today&rsquo;s price would be a
          projection through a wall rather than a plan.
        </p>
      )}

      {plan.rewardNote && (
        <p className="mt-4 rounded-xl border border-[var(--color-ink-700)] p-3.5 text-sm leading-relaxed text-[var(--color-paper-dim)]">
          {plan.rewardNote}
        </p>
      )}

      {plan.positionSizeExample.shares > 0 && (
        <div className="mt-5 rounded-xl border border-[var(--color-ink-700)] bg-[var(--color-ink-950)] p-4">
          <div className="label">Position sizing example</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-paper-dim)]">
            On a {formatPrice(plan.positionSizeExample.accountSize)} account risking{" "}
            {plan.positionSizeExample.riskPercent}% per trade, {waiting ? "the planned" : "the"} stop
            distance implies{" "}
            <span className="metric text-[var(--color-paper)]">{plan.positionSizeExample.shares} shares</span>{" "}
            — {formatPrice(plan.positionSizeExample.capitalRequired)} of capital. Size falls automatically
            as volatility rises, which is what keeps risk constant across different stocks.
          </p>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-[var(--color-paper-faint)]">
        Current price {formatPrice(price)}. These levels are generated from price data alone and take
        no account of upcoming earnings, corporate actions or your own position.
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
  const toneClass =
    tone === "bull" ? "bull" : tone === "bear" ? "bear" : tone === "accent" ? "text-[var(--color-signal-400)]" : "";
  return (
    <div className="min-w-0 rounded-xl border border-[var(--color-ink-700)] bg-[color-mix(in_oklab,var(--color-ink-950)_45%,transparent)] p-3">
      <div className="label truncate">{label}</div>
      <div className={cn("metric mt-1 truncate text-base", toneClass)}>{value}</div>
      <div className="mt-0.5 text-xs leading-snug text-[var(--color-paper-faint)]">{note}</div>
    </div>
  );
}

/**
 * Narrative, key points and risks.
 *
 * When `points` is supplied the summary renders as labelled rows rather than a
 * paragraph. The label column narrows from 8.5rem to 6rem below `sm` so it
 * never eats more than a third of a 360px card.
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
      <div className="surface animate-fade-up p-5 sm:p-6">
        <h3 className="text-lg sm:text-xl">What this adds up to</h3>

        {points && points.length > 0 ? (
          <ul className="mt-5 space-y-4">
            {points.map((point, i) => (
              <li
                key={point.label}
                className={cn(
                  "grid animate-fade-up gap-x-4 gap-y-1 sm:grid-cols-[6.5rem_1fr] lg:grid-cols-[8.5rem_1fr]",
                  `stagger-${Math.min(i + 1, 6)}`,
                )}
              >
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
                <p className="max-w-[62ch] text-sm leading-relaxed text-[var(--color-paper-dim)]">
                  {point.text}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="narrative mt-4">{narrative}</p>
        )}
      </div>

      <div className="space-y-5">
        <div className="surface animate-fade-up stagger-1 p-4 sm:p-5">
          <h3 className="text-base sm:text-lg">Key readings</h3>
          <ul className="mt-3 space-y-2">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-[var(--color-paper-dim)]">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--color-signal-500)]" />
                <span className="min-w-0">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface animate-fade-up stagger-2 p-4 sm:p-5">
          <h3 className="text-base sm:text-lg">What could go wrong</h3>
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
    <div className="surface animate-fade-up p-4 sm:p-5">
      <h3 className="text-lg sm:text-xl">Support and resistance</h3>
      <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">
        Clustered from confirmed swing pivots, then scored on how often price reacted there and how
        recently.
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
              className="flex items-center gap-2.5 rounded-xl border border-[var(--color-ink-700)] px-3 py-2.5 transition-colors duration-150 hover:border-[var(--line-gold)] sm:gap-3 sm:px-3.5"
            >
              <span className={cn("chip shrink-0", level.kind === "support" ? "chip-bull" : "chip-bear")}>
                {level.kind === "support" ? "Support" : "Resistance"}
              </span>
              <span className="metric min-w-0 flex-1 truncate text-sm">{formatPrice(level.price)}</span>
              <span className="metric w-14 shrink-0 text-right text-xs text-[var(--color-paper-faint)]">
                {formatPercent(distance, 1)}
              </span>
              <span className="hidden w-20 shrink-0 sm:block">
                <span className="label">{level.touches} touches</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--color-ink-700)] pt-4 sm:gap-4">
        <div className="min-w-0">
          <div className="label truncate">52-week position</div>
          <div className="metric mt-1 text-base">{structure.fiftyTwoWeekPosition.toFixed(0)}%</div>
        </div>
        <div className="min-w-0">
          <div className="label truncate">From high</div>
          <div className="metric mt-1 text-base bear">{formatPercent(structure.distanceFromHigh, 1)}</div>
        </div>
        <div className="min-w-0">
          <div className="label truncate">From low</div>
          <div className="metric mt-1 text-base bull">{formatPercent(structure.distanceFromLow, 1)}</div>
        </div>
      </div>
    </div>
  );
}
