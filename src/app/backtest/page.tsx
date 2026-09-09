import { Suspense } from "react";
import type { Metadata } from "next";
import { AppNav, AppFooter } from "@/components/layout/app-nav";
import { BacktestWorkspace } from "@/components/backtest/backtest-workspace";
import { Disclaimer, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Backtest",
  description: "Test swing and positional strategies with real trading costs and no lookahead bias.",
};

export default function BacktestPage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <header className="mb-8 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl">Backtest</h1>
          <p className="mt-3 text-[var(--color-paper-dim)]">
            Seven strategies with tunable parameters, tested honestly. The most useful thing you can do here is run a
            trend follower and a mean-reversion system on the same stock — whichever wins tells you what kind of market
            that stock actually lives in.
          </p>
        </header>

        {/* useSearchParams needs a Suspense boundary during prerender. */}
        <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
          <BacktestWorkspace />
        </Suspense>

        <Disclaimer className="mt-10 max-w-3xl" />
      </main>
      <AppFooter />
    </>
  );
}
