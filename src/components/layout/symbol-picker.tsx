"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { SearchResult, Sourced } from "@/types";

/** Stable identity so a closed or empty picker never changes the rendered array. */
const EMPTY_RESULTS: SearchResult[] = [];
import { cn } from "@/lib/utils/cn";

/**
 * Inline symbol picker for forms.
 *
 * Backed by `/api/search`, so it reaches the whole ~3,150-name NSE universe.
 * The previous approach — a `<datalist>` holding every symbol — would now mean
 * shipping the entire universe table to the browser on every page load.
 */
export function SymbolPicker({
  value,
  onChange,
  id,
  placeholder = "RELIANCE.NS",
}: {
  value: string;
  onChange: (symbol: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Track the parent's value without an effect: when it changes underneath us
  // (a URL param, say), adopt it during render rather than after commit.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setQuery(value);
  }

  // Derived rather than stored, so closing the dropdown does not need a state
  // reset from inside an effect.
  const visibleResults = open && query.trim().length > 0 ? results : EMPTY_RESULTS;

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 1) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
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
  }, [query, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(symbol: string) {
    onChange(symbol);
    setQuery(symbol);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-[var(--color-paper-faint)]"
      >
        <Search size={15} />
      </span>

      <input
        id={inputId}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (visibleResults.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % visibleResults.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + visibleResults.length) % visibleResults.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(visibleResults[active].symbol);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="field h-10 pl-10 pr-10"
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={visibleResults.length > 0}
        aria-controls={`${inputId}-listbox`}
        aria-autocomplete="list"
      />

      {loading && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--color-paper-faint)]"
        >
          <Loader2 size={15} className="animate-spin" />
        </span>
      )}

      {visibleResults.length > 0 && (
        <ul
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-ink-600)] bg-[var(--color-ink-850)] py-1 shadow-2xl"
        >
          {visibleResults.map((r, i) => (
            <li key={r.symbol}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r.symbol)}
                className={cn(
                  "w-full px-3 py-2 text-left transition-colors",
                  i === active ? "bg-[var(--color-ink-700)]" : "hover:bg-[var(--color-ink-800)]",
                )}
              >
                <span className="block truncate text-sm text-[var(--color-paper)]">{r.name}</span>
                <span className="metric block text-xs text-[var(--color-paper-faint)]">{r.symbol}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
