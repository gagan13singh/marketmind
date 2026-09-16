"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SymbolSearch } from "./symbol-search";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/screener", label: "Screener" },
  { href: "/backtest", label: "Backtest" },
];

/**
 * Application navigation.
 *
 * Two deliberate changes from the previous version:
 *
 *  1. `SymbolSearch` is mounted TWICE, not three times. The old layout had a
 *     desktop instance, a mobile-panel instance and a separate tablet row,
 *     which meant three independent debounce timers and three `/api/search`
 *     requests racing for the same keystrokes. The search now spans md and up
 *     inline, with the panel instance only ever mounted below md.
 *  2. The mobile panel closes on navigation. Without that, tapping a link on a
 *     phone leaves the panel open over the page it just loaded.
 */
export function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close the panel whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // The header earns its border and shadow only once the page has moved, so
  // at rest it sits flush against the hero instead of drawing a line across it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A panel open behind a scrolling page is disorienting on a phone.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        "bg-[color-mix(in_oklab,var(--color-ink-950)_82%,transparent)] backdrop-blur-2xl",
        scrolled
          ? "border-b border-[var(--line)] shadow-[0_8px_24px_-16px_rgba(2,5,11,0.9)]"
          : "border-b border-transparent",
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="shell flex h-16 items-center gap-3 sm:gap-4">
        {/* ── Brand ──────────────────────────────────────────────────── */}
        <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="MarketMind home">
          <Logo />
          <Wordmark />
        </Link>

        {/* ── Desktop nav ─────────────────────────────────────────────── */}
        <nav className="hidden shrink-0 items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200",
                  isActive
                    ? "border-[var(--line-gold)] bg-[color-mix(in_oklab,var(--color-signal-500)_12%,transparent)] text-[var(--color-paper)]"
                    : "border-transparent text-[var(--color-paper-dim)] hover:bg-[color-mix(in_oklab,var(--color-ink-800)_70%,transparent)] hover:text-[var(--color-paper)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Search: one instance, md and up ──────────────────────────── */}
        <div className="ml-auto hidden min-w-0 w-full max-w-md md:block">
          <SymbolSearch placeholder="Search NSE stocks…" />
        </div>

        {/* ── Hamburger ───────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="ml-auto grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--line-strong)] text-[var(--color-paper-dim)] transition-colors hover:border-[var(--line-gold)] hover:text-[var(--color-paper)] md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
        >
          <span
            className="transition-transform duration-300"
            style={{ transform: mobileOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </span>
        </button>
      </div>

      {/* ── Mobile panel ──────────────────────────────────────────────── */}
      <div
        id="mobile-nav-panel"
        className={cn(
          "overflow-hidden border-t transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden",
          mobileOpen
            ? "max-h-[70vh] border-[var(--line)] opacity-100"
            : "pointer-events-none max-h-0 border-transparent opacity-0",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className="shell pb-5 pt-4"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {/* Only mounted below md, so it never races the desktop instance. */}
          <SymbolSearch placeholder="Search NSE stocks…" />

          <nav className="mt-3 flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((item, i) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-xl px-3.5 py-3 text-sm transition-colors",
                    mobileOpen && `animate-fade-up stagger-${i + 1}`,
                    isActive
                      ? "bg-[color-mix(in_oklab,var(--color-signal-500)_11%,transparent)] text-[var(--color-paper)]"
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
    </header>
  );
}

/** Real brand logo — shown as a crisp square at the requested size. */
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
 * Wordmark that matches the actual logo: "Market" white, "Mind" emerald.
 * Uses the exact green from the logo rather than the data-encoding bull colour,
 * so the wordmark stays consistent regardless of market conditions.
 */
function Wordmark() {
  return (
    <span className="font-display text-[1.1rem] font-medium leading-none tracking-tight transition-opacity duration-150 group-hover:opacity-85">
      <span className="text-[var(--color-paper)]">Market</span>
      <span style={{ color: "#3fb68b" }}>Mind</span>
    </span>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-16">
      <div className="divider" />
      <div
        className="shell py-8"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo size={22} />
            <span className="min-w-0 text-sm">
              <span className="text-[var(--color-paper)]">Market</span>
              <span style={{ color: "#3fb68b" }} className="font-medium">
                Mind
              </span>
              <span className="ml-1.5 text-[var(--color-paper-faint)]">— Think Markets Ahead</span>
            </span>
          </div>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--color-paper-faint)]"
            aria-label="Footer"
          >
            <Link href="/dashboard" className="transition-colors hover:text-[var(--color-paper)]">
              Dashboard
            </Link>
            <Link href="/screener" className="transition-colors hover:text-[var(--color-paper)]">
              Screener
            </Link>
            <Link href="/backtest" className="transition-colors hover:text-[var(--color-paper)]">
              Backtest
            </Link>
          </nav>
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[var(--color-paper-faint)]">
          Analysis is generated by a rules engine from historical price and filing data. It is not
          investment advice and does not account for your circumstances. Market data may be delayed
          or, where a live source is unavailable, replaced by clearly labelled sample data. Do your
          own research before acting.
        </p>
      </div>
    </footer>
  );
}
