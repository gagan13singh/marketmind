"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CornerDownLeft } from "lucide-react";
import type { SearchResult, Sourced } from "@/types";

/** Stable identity so an empty query never changes the rendered array. */
const EMPTY_RESULTS: SearchResult[] = [];
import { normalizeSymbol } from "@/lib/data/symbols";
import { cn } from "@/lib/utils/cn";

/**
 * Symbol search over the full NSE universe.
 *
 * Layout note: the input's horizontal padding is set with utilities that must
 * clear the icons sitting on top of it. That only works because `.field` lives
 * in `@layer components` — unlayered component CSS would beat the utility and
 * the icon would sit on the text, which is exactly the bug this replaced.
 */
export function SymbolSearch({
  size = "md",
  placeholder = "Search 3,000+ NSE stocks — try Reliance, TCS or HDFC Bank",
  autoFocus = false,
}: {
  size?: "md" | "lg";
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const large = size === "lg";

  // `results` is only ever read through this, so an empty query needs no state
  // reset — clearing state from inside the effect would cascade a render.
  const visibleResults = trimmed.length > 0 ? results : EMPTY_RESULTS;

  useEffect(() => {
    if (trimmed.length < 1) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=8`);
        if (!res.ok) throw new Error("search failed");
        const json: Sourced<SearchResult[]> = await res.json();
        if (cancelled) return;
        setResults(json.data ?? []);
        setActive(0);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDismissed(true);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const open = trimmed.length > 0 && !dismissed;

  function go(symbol: string) {
    setDismissed(true);
    setQuery("");
    router.push(`/stock/${encodeURIComponent(symbol)}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || visibleResults.length === 0) {
      if (event.key === "Enter" && trimmed) go(normalizeSymbol(trimmed));
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % visibleResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + visibleResults.length) % visibleResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(visibleResults[active]?.symbol ?? normalizeSymbol(trimmed));
    } else if (event.key === "Escape") {
      setDismissed(true);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        {/* Icon is absolutely positioned; the input reserves matching padding. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 flex items-center text-[var(--color-paper-faint)]",
            large ? "w-12 justify-center" : "w-10 justify-center",
          )}
        >
          <Search size={large ? 18 : 15} />
        </span>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDismissed(false);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setDismissed(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search for a stock"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          className={cn(
            "field",
            large ? "h-14 rounded-xl pl-12 pr-12 text-base" : "h-10 pl-10 pr-10",
          )}
        />

        {loading && (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center text-[var(--color-paper-faint)]",
              large ? "w-12" : "w-10",
            )}
          >
            <Loader2 size={large ? 18 : 15} className="animate-spin" />
          </span>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-[var(--color-ink-600)] bg-[var(--color-ink-850)] shadow-2xl">
          {visibleResults.length === 0 ? (
            <div className="px-4 py-5 text-sm text-[var(--color-paper-dim)]">
              {loading ? "Searching…" : `No match for “${query}”. Press Enter to open it as an NSE symbol anyway.`}
            </div>
          ) : (
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto py-1">
              {visibleResults.map((r, i) => (
                <li key={r.symbol}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.symbol)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                      i === active ? "bg-[var(--color-ink-700)]" : "hover:bg-[var(--color-ink-800)]",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-[var(--color-paper)]">{r.name}</span>
                      <span className="metric block text-xs text-[var(--color-paper-faint)]">
                        {r.symbol} · {r.exchange}
                        {r.type && r.type !== "Equity" ? ` · ${r.type}` : ""}
                      </span>
                    </span>
                    {i === active && (
                      <CornerDownLeft size={14} className="shrink-0 text-[var(--color-paper-faint)]" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
