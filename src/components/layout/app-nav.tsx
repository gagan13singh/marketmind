"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SymbolSearch } from "./symbol-search";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/screener", label: "Screener" },
  { href: "/backtest", label: "Backtest" },
];

export function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[color-mix(in_oklab,var(--color-ink-600)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-ink-950)_85%,transparent)] backdrop-blur-2xl shadow-[0_1px_0_0_color-mix(in_oklab,var(--color-ink-600)_30%,transparent)]">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        {/* ── Brand ──────────────────────────────────────────────────── */}
        <Link href="/" className="flex shrink-0 items-center gap-2 group" aria-label="MarketMind home">
          <Logo />
          <Wordmark />
        </Link>

        {/* ── Desktop nav ─────────────────────────────────────────────── */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm transition-all duration-150",
                  isActive
                    ? "bg-[color-mix(in_oklab,var(--color-signal-500)_12%,transparent)] text-[var(--color-paper)] border border-[color-mix(in_oklab,var(--color-signal-500)_25%,transparent)] shadow-[0_0_12px_rgba(242,169,59,0.1)]"
                    : "text-[var(--color-paper-dim)] hover:text-[var(--color-paper)] hover:bg-[color-mix(in_oklab,var(--color-ink-800)_60%,transparent)] border border-transparent",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Desktop search ───────────────────────────────────────────── */}
        <div className="ml-auto hidden w-full max-w-md lg:block">
          <SymbolSearch />
        </div>

        {/* ── Hamburger ───────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="ml-auto grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--color-ink-600)] text-[var(--color-paper-dim)] transition-colors hover:border-[var(--color-ink-500,#2a3a58)] hover:text-[var(--color-paper)] md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          <span
            className="transition-all duration-200"
            style={{ transform: mobileOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </span>
        </button>
      </div>

      {/* ── Mobile panel ──────────────────────────────────────────────── */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out md:hidden",
          mobileOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="border-t border-[var(--color-ink-700)] px-4 pb-4 pt-3">
          <SymbolSearch />
          <nav className="mt-3 flex flex-col gap-0.5" aria-label="Mobile">
            {NAV.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-[color-mix(in_oklab,var(--color-signal-500)_10%,transparent)] text-[var(--color-paper)]"
                      : "text-[var(--color-paper-dim)] hover:bg-[var(--color-ink-800)] hover:text-[var(--color-paper)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Tablet search (md only) ─────────────────────────────────── */}
      <div className="hidden border-t border-[var(--color-ink-700)] px-4 pb-3 md:block lg:hidden sm:px-6">
        <SymbolSearch />
      </div>
    </header>
  );
}

/**
 * Real brand logo — the JPG provided by the design brief.
 * We show it as a crisp square at the requested size.
 */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <Image
      src="/icons/logo.png"
      alt="MarketMind logo"
      width={size}
      height={size}
      className="rounded-lg"
      priority
    />
  );
}

/**
 * Wordmark that matches the actual logo: "Market" white, "Mind" emerald-green.
 * Using the exact green from the logo (#22c55e) rather than the data-encoding
 * bull colour so the wordmark stays consistent regardless of market conditions.
 */
function Wordmark() {
  return (
    <span className="font-display text-[1.1rem] font-medium tracking-tight leading-none transition-opacity duration-150 group-hover:opacity-85">
      <span className="text-[var(--color-paper)]">Market</span>
      <span style={{ color: "#3fb68b" }}>Mind</span>
    </span>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-16">
      <div className="divider" />
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size={22} />
            <span className="text-sm">
              <span className="text-[var(--color-paper)]">Market</span>
              <span style={{ color: "#3fb68b" }} className="font-medium">Mind</span>
              <span className="ml-1.5 text-[var(--color-paper-faint)]">— Think Markets Ahead</span>
            </span>
          </div>
          <nav className="flex gap-4 text-sm text-[var(--color-paper-faint)]" aria-label="Footer">
            <Link href="/dashboard" className="transition-colors hover:text-[var(--color-paper)]">Dashboard</Link>
            <Link href="/screener" className="transition-colors hover:text-[var(--color-paper)]">Screener</Link>
            <Link href="/backtest" className="transition-colors hover:text-[var(--color-paper)]">Backtest</Link>
          </nav>
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[var(--color-paper-faint)]">
          Analysis is generated by a rules engine from historical price and filing data. It is not investment advice and
          does not account for your circumstances. Market data may be delayed or, where a live source is unavailable,
          replaced by clearly labelled sample data. Do your own research before acting.
        </p>
      </div>
    </footer>
  );
}
