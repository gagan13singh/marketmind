"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useSafeReducedMotion } from "@/lib/hooks/use-safe-reduced-motion";
import {
  Activity,
  FileSpreadsheet,
  Filter,
  LineChart,
  Layers,
  ShieldAlert,
} from "lucide-react";

/**
 * Scroll-driven pipeline.
 *
 * Scrolling here advances the reader through what the engine actually does to
 * raw price data — the motion carries information rather than decorating the
 * section. A sticky panel holds the current stage while the descriptions move
 * past it, so the relationship between stage and explanation stays visible.
 */

const STAGES = [
  {
    title: "Raw price and filings arrive",
    body: "Five years of daily candles plus the last five annual reports and eight quarters. Nothing is interpreted yet — this is the same data everyone has.",
    metric: "1,260 candles",
    detail: "OHLCV, daily",
  },
  {
    title: "Indicators are computed",
    body: "RSI, ADX, ATR, MACD, Stochastic, Bollinger, Supertrend, OBV and Money Flow. Swing periods on daily candles; positional analysis re-runs the same maths on weekly bars so the horizons genuinely differ.",
    metric: "24 readings",
    detail: "Across five signal groups",
  },
  {
    title: "Each reading is scored and weighted",
    body: "Every indicator is mapped onto one −100 to +100 scale. Trend carries more weight for positional holds, momentum more for swings — which is why the two horizons can disagree about the same chart.",
    metric: "−100 → +100",
    detail: "Horizon-specific weighting",
  },
  {
    title: "Conclusions are written",
    body: "ADX below 20 does not say “weak trend”. It says there is no trend to ride, and that breakout entries fail most often in exactly this regime. Every number gets its “so what”.",
    metric: "Plain English",
    detail: "Per reading, not per page",
  },
  {
    title: "A plan comes out",
    body: "Entry band, ATR-based stop, R-multiple targets that respect real resistance, and the position size that keeps risk at 1% of the account. Plus the risks that contradict the call.",
    metric: "Entry · Stop · Target",
    detail: "With position sizing",
  },
];

export function Pipeline() {
  const reduce = useSafeReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <section
      ref={ref}
      className="relative mx-auto max-w-[1400px] px-4 sm:px-6"
      aria-label="How the analysis works"
    >
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        {/* Sticky side keeps the current stage anchored while text scrolls. */}
        <div className="lg:sticky lg:top-24 lg:h-fit lg:py-24">
          <h2 className="text-3xl sm:text-4xl">
            What happens between
            <br />
            <span className="text-gradient">the chart and the call</span>
          </h2>
          <p className="mt-5 max-w-md text-[var(--color-paper-dim)]">
            Most tools stop at drawing the indicator. The work that matters is
            everything after that — and it is the part people don&apos;t have
            time to do every evening.
          </p>

          {!reduce && (
            <div className="mt-8 hidden lg:block">
              <ProgressRail progress={scrollYProgress} />
            </div>
          )}
        </div>

        <ol className="space-y-6 py-8 lg:py-24">
          {STAGES.map((stage, i) => (
            <StageCard
              key={stage.title}
              stage={stage}
              index={i}
              reduce={!!reduce}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

function ProgressRail({ progress }: { progress: MotionValue<number> }) {
  const height = useTransform(progress, [0, 1], ["0%", "100%"]);
  return (
    <div className="relative h-40 w-px bg-[var(--color-ink-700)]">
      <motion.div
        style={{ height }}
        className="absolute left-0 top-0 w-px bg-[var(--color-signal-500)]"
      />
    </div>
  );
}

function StageCard({
  stage,
  index,
  reduce,
}: {
  stage: (typeof STAGES)[number];
  index: number;
  reduce: boolean;
}) {
  return (
    <motion.li
      initial={reduce ? undefined : { opacity: 0, y: 20 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="surface p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {/* Numbering is used here because this genuinely is a sequence. */}
          <span className="metric text-xs text-[var(--color-signal-500)]">
            Stage {index + 1}
          </span>
          <h3 className="mt-2 text-xl">{stage.title}</h3>
          <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-[var(--color-paper-dim)]">
            {stage.body}
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <div className="metric text-sm text-[var(--color-paper)]">
            {stage.metric}
          </div>
          <div className="mt-0.5 text-xs text-[var(--color-paper-faint)]">
            {stage.detail}
          </div>
        </div>
      </div>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------

const MODULES = [
  {
    icon: LineChart,
    title: "Technical analysis",
    body: "Five signal groups — trend, momentum, structure, volume, volatility — each scored and explained. Support and resistance are clustered from real swing pivots, not round numbers.",
    href: "/stock/RELIANCE.NS/technical",
    linkLabel: "See a technical workup",
  },
  {
    icon: FileSpreadsheet,
    title: "Fundamental analysis",
    body: "Balance sheet, P&L, cash flow and shareholding across five years. Cash conversion is treated as the earnings-quality test, and pledged promoter shares are flagged as the structural risk they are.",
    href: "/stock/RELIANCE.NS/fundamental",
    linkLabel: "See a fundamental workup",
  },
  {
    icon: Filter,
    title: "Custom screener",
    body: "Build filters from 22 fields across price, liquidity and technicals, or start from a preset like “pullback in uptrend”. Results carry the same composite score as the detail pages.",
    href: "/screener",
    linkLabel: "Open the screener",
  },
  {
    icon: Activity,
    title: "Strategy backtesting",
    body: "Seven strategies with tunable parameters, tested with real costs and no lookahead. Signals fill at the next bar's open, never the close you have already seen.",
    href: "/backtest",
    linkLabel: "Run a backtest",
  },
];

export function Modules() {
  const reduce = useSafeReducedMotion();
  return (
    <section
      className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6"
      aria-label="Modules"
    >
      <h2 className="max-w-2xl text-3xl sm:text-4xl">
        Four tools that share <span className="text-gradient-gold">one engine</span>
      </h2>
      <p className="mt-4 max-w-2xl text-[var(--color-paper-dim)]">
        The score you see in a screener result is computed the same way as the
        score on the stock&apos;s own page. There is no second, simpler model
        running behind the list.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {MODULES.map((m, i) => (
          <motion.article
            key={m.title}
            initial={reduce ? undefined : { opacity: 0, y: 20 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.5,
              delay: i * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="surface flex flex-col p-6"
          >
            <m.icon
              size={22}
              className="text-[var(--color-signal-500)]"
              aria-hidden="true"
            />
            <h3 className="mt-4 text-xl">{m.title}</h3>
            <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[var(--color-paper-dim)]">
              {m.body}
            </p>
            <Link
              href={m.href}
              className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm text-[var(--color-signal-400)] hover:text-[var(--color-signal-500)]"
            >
              {m.linkLabel}
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function HorizonSection() {
  const reduce = useSafeReducedMotion();
  return (
    <section className="border-y border-[color-mix(in_oklab,var(--color-ink-600)_40%,transparent)] bg-[var(--color-ink-950)]">
      <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <Layers
              size={24}
              className="text-[var(--color-signal-500)]"
              aria-hidden="true"
            />
            <h2 className="mt-5 text-3xl sm:text-4xl">
              No intraday. <span className="text-gradient-gold">On purpose.</span>
            </h2>
            <p className="mt-5 text-[var(--color-paper-dim)]">
              Intraday analysis is a different discipline with different data
              requirements and a different failure mode. Bolting it on would
              make every other feature worse.
            </p>
            <p className="mt-4 text-[var(--color-paper-dim)]">
              So the timeframe options are daily, weekly and monthly — and the
              type system itself has no intraday path. The constraint is the
              feature.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                name: "Swing",
                window: "1–6 weeks",
                lead: "Daily structure leads, weekly confirms",
                points: [
                  "Momentum weighted at 30% of the composite",
                  "ATR × 2 stops — tight enough to keep risk small",
                  "Targets at 1.5R, 2.5R and 4R",
                  "Timing signals like Stochastic actually matter",
                ],
              },
              {
                name: "Positional",
                window: "3–12+ months",
                lead: "Weekly and monthly structure leads",
                points: [
                  "Trend weighted at 40% of the composite",
                  "ATR × 3 stops — wide enough to survive noise",
                  "Targets at 2R, 4R and 6R",
                  "Fundamentals carry real decision weight",
                ],
              },
            ].map((h, i) => (
              <motion.div
                key={h.name}
                initial={reduce ? undefined : { opacity: 0, y: 18 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="surface p-6"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl">{h.name}</h3>
                  <span className="metric text-sm text-[var(--color-signal-400)]">
                    {h.window}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-paper-faint)]">
                  {h.lead}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {h.points.map((p) => (
                    <li
                      key={p}
                      className="flex gap-2.5 text-sm text-[var(--color-paper-dim)]"
                    >
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--color-signal-500)]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function HonestySection() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <ShieldAlert
            size={24}
            className="text-[var(--color-signal-500)]"
            aria-hidden="true"
          />
          <h2 className="mt-5 text-3xl sm:text-4xl">
            What this tool will not do
          </h2>
        </div>
        <div className="space-y-5">
          {[
            {
              q: "It will not hide when the evidence is thin.",
              a: "Confidence is computed from how much the five signal groups agree, not from how strong the call sounds. When they disagree, the verdict is pulled toward neutral and the contradiction is written out in the risks section.",
            },
            {
              q: "It will not show you a backtest that flatters itself.",
              a: "Signals execute at the next bar's open, brokerage and slippage and STT are charged on every trade, and stops resolve against the bar's actual low. A frictionless backtest is a marketing document, not a test.",
            },
            {
              q: "It will not pass off sample data as real.",
              a: "When the market data source is rate-limited or unreachable, the app keeps working on generated data — and labels it as sample data everywhere it appears, including in the screener results.",
            },
            {
              q: "It will not tell you what to buy.",
              a: "It is a rules engine reading historical data. It knows nothing about your capital, your timeframe, your tax position or your tolerance for a 30% drawdown. The analysis is an input to your decision, not a substitute for it.",
            },
          ].map((item) => (
            <div
              key={item.q}
              className="border-l-2 border-[var(--color-ink-600)] pl-5"
            >
              <h3 className="font-display text-xl">{item.q}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-paper-dim)]">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
      <div className="surface-raised grid-lines overflow-hidden px-6 py-20 text-center sm:px-12">
        <p className="text-sm text-[var(--color-signal-400)] tracking-widest uppercase font-medium mb-4">Free · No account required</p>
        <h2 className="mx-auto max-w-2xl text-3xl sm:text-4xl">
          Pick a stock. Get the workup
          <br /><span className="text-gradient">in about a second.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[var(--color-paper-dim)]">
          No account, no key, no setup. The engine runs on public market data
          and works out of the box.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="btn btn-primary animate-glow-pulse">
            Open the desk
          </Link>
          <Link href="/screener" className="btn btn-ghost">
            Start from a screen
          </Link>
        </div>
      </div>
    </section>
  );
}
