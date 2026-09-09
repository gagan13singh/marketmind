"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useSafeReducedMotion } from "@/lib/hooks/use-safe-reduced-motion";
import { ArrowRight } from "lucide-react";
import { MarketField } from "./market-field";
import { SymbolSearch } from "@/components/layout/symbol-search";
import { Logo } from "@/components/layout/app-nav";

/**
 * Hero.
 *
 * The opening move is the product's actual output — a written verdict with the
 * evidence behind it — rather than an abstract illustration. Someone who reads
 * only this panel already understands what the product does.
 */
export function Hero() {
  const reduce = useSafeReducedMotion();

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.6,
            delay,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        };

  return (
    <section className="relative isolate overflow-hidden">
      <MarketField />

      <div className="relative mx-auto max-w-[1400px] px-4 pb-20 pt-6 sm:px-6 lg:pb-28">
        {/* Minimal top bar — the landing page has no product chrome. */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg tracking-tight">
              MarketMind
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/screener"
              className="btn btn-ghost hidden sm:inline-flex"
            >
              Screener
            </Link>
            <Link href="/dashboard" className="btn btn-primary">
              Open the desk
            </Link>
          </div>
        </div>

        <div className="grid gap-12 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-24">
          {/* --- Left: the proposition ------------------------------------ */}
          <div className="max-w-2xl">
            <motion.p
              {...rise(0)}
              className="text-sm text-[var(--color-signal-400)]"
            >
              Built for holding periods measured in weeks and months
            </motion.p>

            <motion.h1
              {...rise(0.08)}
              className="mt-5 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
            >
              Stop reading charts.
              <br />
              Read the conclusion.
            </motion.h1>

            <motion.p
              {...rise(0.16)}
              className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-paper-dim)]"
            >
              MarketMind runs the full technical and fundamental workup on any
              NSE stock — RSI, ADX, ATR, market structure, balance sheet, cash
              flow, shareholding — and writes out what it actually means for a
              swing or positional position.
            </motion.p>

            <motion.div {...rise(0.24)} className="mt-8 max-w-lg">
              <SymbolSearch size="lg" />
              <p className="mt-3 text-sm text-[var(--color-paper-faint)]">
                Or jump straight to{" "}
                <Link
                  href="/stock/RELIANCE.NS"
                  className="text-[var(--color-signal-400)] underline underline-offset-4"
                >
                  Reliance
                </Link>
                ,{" "}
                <Link
                  href="/stock/TCS.NS"
                  className="text-[var(--color-signal-400)] underline underline-offset-4"
                >
                  TCS
                </Link>{" "}
                or{" "}
                <Link
                  href="/stock/HDFCBANK.NS"
                  className="text-[var(--color-signal-400)] underline underline-offset-4"
                >
                  HDFC Bank
                </Link>
                .
              </p>
            </motion.div>

            <motion.dl
              {...rise(0.32)}
              className="mt-12 grid grid-cols-3 gap-6 border-t border-[var(--color-ink-700)] pt-6"
            >
              {[
                {
                  value: "24",
                  label: "indicators and ratios scored per stock",
                },
                { value: "7", label: "backtestable strategies" },
                { value: "0", label: "intraday noise" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="metric text-2xl text-[var(--color-paper)]">
                    {item.value}
                  </dt>
                  <dd className="mt-1 text-xs leading-snug text-[var(--color-paper-faint)]">
                    {item.label}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* --- Right: the product's actual output ----------------------- */}
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 24 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="lg:pt-4"
          >
            <VerdictPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * A static, representative sample of a technical verdict. Deliberately not
 * live-fetched — the hero must render instantly and identically every time,
 * and it is labelled as an example so it is never mistaken for a real call.
 */
function VerdictPreview() {
  const readings = [
    {
      label: "Trend",
      value: "Bullish stack",
      tone: "bull" as const,
      detail: "Price above 20 > 50 > 200 EMA",
    },
    {
      label: "ADX (14)",
      value: "28.4",
      tone: "bull" as const,
      detail: "Genuine trend, not chop",
    },
    {
      label: "RSI (14)",
      value: "61.2",
      tone: "bull" as const,
      detail: "Continuation zone, not exhausted",
    },
    {
      label: "ATR",
      value: "2.1%",
      tone: "flat" as const,
      detail: "Healthy band for swing sizing",
    },
    {
      label: "Volume",
      value: "1.42x",
      tone: "bull" as const,
      detail: "Real participation behind the move",
    },
  ];

  return (
    <div className="surface-raised overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--color-ink-700)] px-5 py-3.5">
        <span className="text-xs text-[var(--color-paper-faint)]">
          Example output · swing horizon
        </span>
        <span className="chip chip-bull">Accumulate</span>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="font-display text-2xl">Composite score</div>
            <p className="label mt-1">Weighted across five signal groups</p>
          </div>
          <div className="metric text-4xl text-[var(--color-bull-500)]">
            +42
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {readings.map((r) => (
            <div key={r.label} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-[var(--color-paper-faint)]">
                {r.label}
              </span>
              <span
                className={`metric w-24 shrink-0 ${r.tone === "bull" ? "bull" : r.tone === "flat" ? "flat" : "bear"}`}
              >
                {r.value}
              </span>
              <span className="min-w-0 truncate text-xs text-[var(--color-paper-dim)]">
                {r.detail}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-[var(--color-ink-700)] bg-[var(--color-ink-950)] p-4">
          <p className="narrative text-[15px] leading-relaxed">
            “Momentum sits in the sweet spot for continuation rather than at an
            extreme, and volume confirms the move is real. The setup favours
            buying a pullback toward the 50 EMA rather than chasing here — stop
            below the last higher low, first target at prior resistance.”
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-paper-faint)]">
          <ArrowRight size={13} />
          Every reading comes with its own written conclusion, not just a number
        </div>
      </div>
    </div>
  );
}
