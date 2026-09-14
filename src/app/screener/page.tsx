import type { Metadata } from "next";
import { AppNav, AppFooter } from "@/components/layout/app-nav";
import { ScreenerWorkspace } from "@/components/screener/screener-workspace";
import { Disclaimer } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Stock Screener",
  description: "Build custom screens across 22 technical and liquidity filters for swing and positional setups across 3,000+ NSE stocks.",
};

export default function ScreenerPage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <header className="mb-8 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl">Stock Screener</h1>
          <p className="mt-3 text-[var(--color-paper-dim)]">
            Filter a curated universe of liquid NSE names on any combination of 22 fields. Results carry the same
            composite score the engine produces on each stock&apos;s own page — there is no simpler model running behind
            the list.
          </p>
        </header>

        <ScreenerWorkspace />
        <Disclaimer className="mt-10 max-w-3xl" />
      </main>
      <AppFooter />
    </>
  );
}
