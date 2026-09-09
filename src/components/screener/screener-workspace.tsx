"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X, Play, Loader2 } from "lucide-react";
import type { ScreenerResponse, ScreenerRule, ScreenerOperator } from "@/types";
import { SCREENER_FIELDS, FIELD_MAP, PRESETS, presetToRules } from "@/lib/screener";
import { SECTORS, SCAN_TIER_OPTIONS, displaySymbol, type ScanTier } from "@/lib/data/symbols";
import { cn } from "@/lib/utils/cn";
import { formatPrice, formatPercent, formatNumber } from "@/lib/utils/format";
import { VerdictBadge, OriginBadge, EmptyState, Skeleton } from "@/components/ui/primitives";

const OPERATORS: { key: ScreenerOperator; label: string }[] = [
  { key: "gt", label: "greater than" },
  { key: "gte", label: "at least" },
  { key: "lt", label: "less than" },
  { key: "lte", label: "at most" },
  { key: "between", label: "between" },
  { key: "eq", label: "equals" },
];

let ruleCounter = 0;
const nextId = () => `rule-${++ruleCounter}`;

export function ScreenerWorkspace() {
  const [rules, setRules] = useState<ScreenerRule[]>(() => presetToRules(PRESETS[0]));
  const [sectors, setSectors] = useState<string[]>([]);
  const [tier, setTier] = useState<ScanTier>("liquid");
  const [activePreset, setActivePreset] = useState<string | null>(PRESETS[0].id);
  const [result, setResult] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules, sectors, tier, sortBy: "technicalScore", sortDir: "desc", limit: 60 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "The screen could not be run.");
      }
      setResult((await res.json()) as ScreenerResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The screen could not be run.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function addRule() {
    const unused = SCREENER_FIELDS.find((f) => !rules.some((r) => r.field === f.key)) ?? SCREENER_FIELDS[0];
    setRules((prev) => [
      ...prev,
      { id: nextId(), field: unused.key, operator: unused.defaultOperator, value: unused.defaultValue, value2: unused.defaultValue * 1.5 },
    ]);
    setActivePreset(null);
  }

  function updateRule(id: string, patch: Partial<ScreenerRule>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setActivePreset(null);
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    setActivePreset(null);
  }

  function applyPreset(presetId: string) {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setRules(presetToRules(preset));
    setActivePreset(preset.id);
  }

  const preset = PRESETS.find((p) => p.id === activePreset);

  return (
    <div className="space-y-6">
      {/* --- Presets ------------------------------------------------------ */}
      <section>
        <h2 className="text-lg">Start from a screen that already means something</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                activePreset === p.id
                  ? "border-[var(--color-signal-500)] bg-[color-mix(in_oklab,var(--color-signal-500)_12%,transparent)] text-[var(--color-signal-400)]"
                  : "border-[var(--color-ink-700)] text-[var(--color-paper-dim)] hover:border-[var(--color-ink-600)] hover:text-[var(--color-paper)]",
              )}
            >
              {p.name}
              <span className="ml-2 text-xs text-[var(--color-paper-faint)]">{p.horizon}</span>
            </button>
          ))}
        </div>
        {preset && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--color-paper-dim)]">{preset.rationale}</p>
        )}
      </section>

      {/* --- Rule builder ------------------------------------------------- */}
      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg">Filters</h2>
            <p className="label mt-0.5">All conditions must be met. A stock with a missing value is excluded.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addRule} className="btn btn-ghost" disabled={rules.length >= 12}>
              <Plus size={14} /> Add filter
            </button>
            <button type="button" onClick={run} className="btn btn-primary" disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {loading ? "Scanning…" : "Run screen"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {rules.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--color-paper-faint)]">
              No filters yet. Add one, or pick a preset above.
            </p>
          )}
          {rules.map((rule) => {
            const field = FIELD_MAP.get(rule.field);
            return (
              <div
                key={rule.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-ink-700)] p-2.5"
              >
                <select
                  value={rule.field}
                  onChange={(e) => {
                    const f = FIELD_MAP.get(e.target.value);
                    updateRule(rule.id, {
                      field: e.target.value,
                      operator: f?.defaultOperator ?? "gt",
                      value: f?.defaultValue ?? 0,
                    });
                  }}
                  className="field w-full sm:w-56"
                  aria-label="Field"
                >
                  {["Price & Liquidity", "Technical"].map((group) => (
                    <optgroup key={group} label={group}>
                      {SCREENER_FIELDS.filter((f) => f.group === group).map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, { operator: e.target.value as ScreenerOperator })}
                  className="field w-full sm:w-36"
                  aria-label="Operator"
                >
                  {OPERATORS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={rule.value}
                  step="any"
                  onChange={(e) => updateRule(rule.id, { value: Number(e.target.value) })}
                  className="field w-full sm:w-28"
                  aria-label="Value"
                />

                {rule.operator === "between" && (
                  <>
                    <span className="text-xs text-[var(--color-paper-faint)]">and</span>
                    <input
                      type="number"
                      value={rule.value2 ?? 0}
                      step="any"
                      onChange={(e) => updateRule(rule.id, { value2: Number(e.target.value) })}
                      className="field w-full sm:w-28"
                      aria-label="Upper value"
                    />
                  </>
                )}

                <span className="hidden min-w-0 flex-1 truncate text-xs text-[var(--color-paper-faint)] lg:block">
                  {field?.description}
                </span>

                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-[var(--color-paper-faint)] hover:bg-[var(--color-ink-800)] hover:text-[var(--color-bear-500)]"
                  aria-label="Remove filter"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-[var(--color-ink-700)] pt-4">
          <div className="label mb-2">Scan depth</div>
          <div className="flex flex-wrap gap-1.5">
            {SCAN_TIER_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                aria-pressed={tier === t.id}
                title={t.description}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  tier === t.id
                    ? "border-[var(--color-signal-500)] bg-[color-mix(in_oklab,var(--color-signal-500)_12%,transparent)] text-[var(--color-signal-400)]"
                    : "border-[var(--color-ink-700)] text-[var(--color-paper-faint)] hover:text-[var(--color-paper-dim)]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-2 max-w-xl text-xs leading-snug text-[var(--color-paper-faint)]">
            {SCAN_TIER_OPTIONS.find((t) => t.id === tier)?.description} Names are ranked by daily
            turnover, so a deeper scan adds progressively less liquid stocks rather than random ones.
          </p>
        </div>

        <div className="mt-5 border-t border-[var(--color-ink-700)] pt-4">
          <div className="label mb-2">Limit to sectors (optional)</div>
          <div className="flex flex-wrap gap-1.5">
            {SECTORS.map((s) => {
              const active = sectors.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSectors((prev) => (active ? prev.filter((x) => x !== s) : [...prev, s]))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-[var(--color-signal-500)] bg-[color-mix(in_oklab,var(--color-signal-500)_12%,transparent)] text-[var(--color-signal-400)]"
                      : "border-[var(--color-ink-700)] text-[var(--color-paper-faint)] hover:text-[var(--color-paper-dim)]",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- Results ------------------------------------------------------ */}
      {error && (
        <div className="surface border-[color-mix(in_oklab,var(--color-bear-500)_40%,transparent)] p-5">
          <h3 className="text-lg bear">The screen could not be run</h3>
          <p className="mt-1.5 text-sm text-[var(--color-paper-dim)]">{error}</p>
          <button type="button" onClick={run} className="btn btn-ghost mt-4">
            Try again
          </button>
        </div>
      )}

      {loading && (
        <div className="surface p-5">
          <p className="text-sm text-[var(--color-paper-dim)]">
            {tier === "all"
              ? "Scanning every listed stock. Angel One allows three history requests per second, so a cold run works through as much of the universe as it can in about 40 seconds and caches what it reads. Run it again to continue from where it stopped."
              : "Scanning. On a cold cache this fetches two years of history per symbol, so the first run takes a few seconds."}
          </p>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </div>
      )}

      {result && !loading && (
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-lg">
                {result.matched} {result.matched === 1 ? "match" : "matches"} from {result.totalScanned} stocks
              </h2>
              <p className="label mt-0.5">
                {result.tierLabel ? `${result.tierLabel} · ` : ""}
                {result.universeSize && result.universeSize !== result.totalScanned
                  ? `${result.totalScanned.toLocaleString("en-IN")} of ${result.universeSize.toLocaleString("en-IN")} read · `
                  : ""}
                {(result.tookMs / 1000).toFixed(1)}s
              </p>
            </div>
            <OriginBadge origin={result.origin} provider={result.provider} notice={result.notice} />
          </div>

          {result.complete === false && (
            <div className="border-t border-[var(--color-ink-700)] bg-[color-mix(in_oklab,var(--color-signal-500)_7%,transparent)] px-5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-paper)]">
                    Partial scan — {(result.remaining ?? 0).toLocaleString("en-IN")} stocks still to read
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-[var(--color-paper-faint)]">
                    Everything fetched so far is cached, so running it again picks up where this stopped and gets
                    further each time.
                  </p>
                </div>
                <button type="button" onClick={run} className="btn btn-ghost shrink-0">
                  Continue scan
                </button>
              </div>
              {result.universeSize ? (
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--color-ink-700)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-signal-500)] transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (result.totalScanned / result.universeSize) * 100).toFixed(1)}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}

          {result.rows.length === 0 ? (
            <EmptyState
              title="Nothing passed every filter"
              description="Loosen a condition or remove one. Filters combine with AND, so each one you add narrows the result set further."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>1D</th>
                    <th>Score</th>
                    <th>RSI</th>
                    <th>ADX</th>
                    <th>ATR%</th>
                    <th>3M</th>
                    <th>12M</th>
                    <th>vs 200 EMA</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.symbol}>
                      <td>
                        <Link
                          href={`/stock/${encodeURIComponent(row.symbol)}`}
                          className="block min-w-0 !font-sans hover:text-[var(--color-signal-400)]"
                        >
                          <span className="block truncate text-sm">{row.name}</span>
                          <span className="metric block text-xs text-[var(--color-paper-faint)]">
                            {displaySymbol(row.symbol)}
                          </span>
                        </Link>
                      </td>
                      <td>{formatPrice(row.price)}</td>
                      <td className={row.changePercent >= 0 ? "bull" : "bear"}>
                        {formatPercent(row.changePercent, 1)}
                      </td>
                      <td
                        className={
                          row.technicalScore >= 20 ? "bull" : row.technicalScore <= -20 ? "bear" : "flat"
                        }
                      >
                        {row.technicalScore > 0 ? "+" : ""}
                        {row.technicalScore.toFixed(0)}
                      </td>
                      <td>{formatNumber(row.metrics.rsi14, 1)}</td>
                      <td>{formatNumber(row.metrics.adx14, 1)}</td>
                      <td>{formatNumber(row.metrics.atrPercent, 2)}</td>
                      <td className={(row.metrics.return3m ?? 0) >= 0 ? "bull" : "bear"}>
                        {formatPercent(row.metrics.return3m, 1)}
                      </td>
                      <td className={(row.metrics.return12m ?? 0) >= 0 ? "bull" : "bear"}>
                        {formatPercent(row.metrics.return12m, 1)}
                      </td>
                      <td className={(row.metrics.distFrom200Ema ?? 0) >= 0 ? "bull" : "bear"}>
                        {formatPercent(row.metrics.distFrom200Ema, 1)}
                      </td>
                      <td className="!font-sans">
                        <VerdictBadge verdict={row.verdict} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!result && !loading && !error && (
        <div className="surface">
          <EmptyState
            title="Run the screen to see matches"
            description="The default screen looks for stocks in a confirmed uptrend with momentum that has not yet run out — a reasonable starting point for a swing entry."
            action={
              <button type="button" onClick={run} className="btn btn-primary mt-2">
                <Play size={14} /> Run screen
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
