import Link from "next/link";
import { AppNav, AppFooter } from "@/components/layout/app-nav";
import { SymbolSearch } from "@/components/layout/symbol-search";

export default function NotFound() {
  return (
    <>
      <AppNav />
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
        <p className="metric text-xs uppercase tracking-widest text-[var(--color-signal-400)]">404</p>
        <h1 className="mt-3 text-4xl">
          That page <span className="text-gradient">doesn&apos;t exist</span>
        </h1>
        <p className="mt-4 text-[var(--color-paper-dim)]">
          Search for a stock below, or head to the dashboard to see the strongest setups right now.
        </p>
        <div className="mt-6">
          <SymbolSearch size="lg" autoFocus />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn btn-primary">Open the dashboard</Link>
          <Link href="/screener" className="btn btn-ghost">Browse the screener</Link>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
