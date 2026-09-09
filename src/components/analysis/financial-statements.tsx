"use client";

import { useState } from "react";
import type { FundamentalSnapshot } from "@/types";
import { cn } from "@/lib/utils/cn";
import { formatIndianCurrency, formatPercent, formatNumber } from "@/lib/utils/format";

/**
 * Financial statements.
 *
 * Figures are shown in the Indian convention (crores), because that is how
 * Indian company filings are actually read. Nulls render as an em dash rather
 * than a zero — a missing figure and a zero figure mean very different things.
 */

type Tab = "pl" | "quarterly" | "balance" | "cashflow" | "shareholding";

const TABS: { key: Tab; label: string }[] = [
  { key: "pl", label: "Profit & loss" },
  { key: "quarterly", label: "Quarterly" },
  { key: "balance", label: "Balance sheet" },
  { key: "cashflow", label: "Cash flow" },
  { key: "shareholding", label: "Shareholding" },
];

export function FinancialStatements({ snapshot }: { snapshot: FundamentalSnapshot }) {
  const [tab, setTab] = useState<Tab>("pl");

  return (
    <div className="surface overflow-hidden">
      <div className="flex gap-1 overflow-x-auto border-b border-[color-mix(in_oklab,var(--color-ink-600)_40%,transparent)] px-2 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors",
              tab === t.key
                ? "border-[var(--color-signal-500)] text-[var(--color-paper)]"
                : "border-transparent text-[var(--color-paper-faint)] hover:text-[var(--color-paper-dim)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto p-1">
        {tab === "pl" && <ProfitLossTable snapshot={snapshot} periods="annual" />}
        {tab === "quarterly" && <ProfitLossTable snapshot={snapshot} periods="quarterly" />}
        {tab === "balance" && <BalanceSheetTable snapshot={snapshot} />}
        {tab === "cashflow" && <CashFlowTable snapshot={snapshot} />}
        {tab === "shareholding" && <ShareholdingPanel snapshot={snapshot} />}
      </div>
    </div>
  );
}

function NoData({ what }: { what: string }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-[var(--color-paper-faint)]">
      No {what} available from the data source for this security.
    </div>
  );
}

function ProfitLossTable({
  snapshot,
  periods,
}: {
  snapshot: FundamentalSnapshot;
  periods: "annual" | "quarterly";
}) {
  const rows = periods === "annual" ? snapshot.annual : snapshot.quarterly;
  if (rows.length === 0) return <NoData what={periods === "annual" ? "annual results" : "quarterly results"} />;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Figures in ₹ crore</th>
          {rows.map((r) => (
            <th key={r.endDate}>{r.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <Row label="Revenue" values={rows.map((r) => r.revenue)} format="currency" />
        <Row label="Operating profit" values={rows.map((r) => r.operatingProfit)} format="currency" />
        <Row label="Net profit" values={rows.map((r) => r.netProfit)} format="currency" />
        <Row label="Operating margin" values={rows.map((r) => r.operatingMargin)} format="percent" />
        <Row label="Net margin" values={rows.map((r) => r.netMargin)} format="percent" />
        {rows.some((r) => r.eps !== null) && <Row label="Earnings per share" values={rows.map((r) => r.eps)} format="number" />}
      </tbody>
    </table>
  );
}

function BalanceSheetTable({ snapshot }: { snapshot: FundamentalSnapshot }) {
  const rows = snapshot.balanceSheet;
  if (rows.length === 0) return <NoData what="balance sheet data" />;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Figures in ₹ crore</th>
          {rows.map((r) => (
            <th key={r.endDate}>{r.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <Row label="Total assets" values={rows.map((r) => r.totalAssets)} format="currency" />
        <Row label="Total liabilities" values={rows.map((r) => r.totalLiabilities)} format="currency" />
        <Row label="Shareholders' equity" values={rows.map((r) => r.totalEquity)} format="currency" emphasis />
        <Row label="Total debt" values={rows.map((r) => r.totalDebt)} format="currency" />
        <Row label="Cash & equivalents" values={rows.map((r) => r.cash)} format="currency" />
        <Row label="Current assets" values={rows.map((r) => r.currentAssets)} format="currency" />
        <Row label="Current liabilities" values={rows.map((r) => r.currentLiabilities)} format="currency" />
        <Row label="Inventory" values={rows.map((r) => r.inventory)} format="currency" />
        <Row label="Receivables" values={rows.map((r) => r.receivables)} format="currency" />
        <Row
          label="Debt to equity"
          values={rows.map((r) =>
            r.totalDebt !== null && r.totalEquity ? r.totalDebt / r.totalEquity : null,
          )}
          format="number"
          emphasis
        />
      </tbody>
    </table>
  );
}

function CashFlowTable({ snapshot }: { snapshot: FundamentalSnapshot }) {
  const rows = snapshot.cashFlow;
  if (rows.length === 0) return <NoData what="cash flow data" />;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Figures in ₹ crore</th>
          {rows.map((r) => (
            <th key={r.endDate}>{r.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <Row label="Operating cash flow" values={rows.map((r) => r.operatingCashFlow)} format="currency" emphasis />
        <Row label="Investing cash flow" values={rows.map((r) => r.investingCashFlow)} format="currency" />
        <Row label="Financing cash flow" values={rows.map((r) => r.financingCashFlow)} format="currency" />
        <Row label="Capital expenditure" values={rows.map((r) => r.capex)} format="currency" />
        <Row label="Free cash flow" values={rows.map((r) => r.freeCashFlow)} format="currency" emphasis />
      </tbody>
    </table>
  );
}

function ShareholdingPanel({ snapshot }: { snapshot: FundamentalSnapshot }) {
  const s = snapshot.shareholding;
  const slices = [
    { label: "Promoter / insiders", value: s.promoter, colour: "var(--color-signal-500)" },
    { label: "Institutions", value: s.institutions, colour: "#7aa2f7" },
    { label: "Foreign institutions", value: s.fii, colour: "#bb9af7" },
    { label: "Domestic institutions", value: s.dii, colour: "#5fcfa4" },
    { label: "Public & others", value: s.public, colour: "var(--color-flat-500)" },
  ].filter((x) => x.value !== null && x.value > 0);

  if (slices.length === 0) return <NoData what="shareholding data" />;

  return (
    <div className="p-4">
      <div className="flex h-3 overflow-hidden rounded-full">
        {slices.map((slice) => (
          <div
            key={slice.label}
            style={{ width: `${slice.value}%`, background: slice.colour }}
            title={`${slice.label}: ${slice.value?.toFixed(1)}%`}
          />
        ))}
      </div>

      <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-sm text-[var(--color-paper-dim)]">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: slice.colour }} />
              {slice.label}
            </dt>
            <dd className="metric text-sm">{formatPercent(slice.value, 2, false)}</dd>
          </div>
        ))}
      </dl>

      {s.pledgedPercent !== null && (
        <div
          className={cn(
            "mt-6 rounded-lg border p-4",
            s.pledgedPercent > 10
              ? "border-[color-mix(in_oklab,var(--color-bear-500)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-bear-500)_8%,transparent)]"
              : "border-[var(--color-ink-700)]",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm">Pledged promoter shares</span>
            <span className={cn("metric text-sm", s.pledgedPercent > 10 ? "bear" : "flat")}>
              {formatPercent(s.pledgedPercent, 2, false)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-paper-dim)]">
            {s.pledgedPercent === 0
              ? "No promoter shares are pledged against loans, which removes a category of forced-selling risk entirely."
              : s.pledgedPercent > 10
                ? "A high pledge level is a structural risk: if the price falls, lenders can invoke the pledge and sell into an already-weak market."
                : "A modest pledge level. Worth monitoring, since pledges tend to grow rather than shrink."}
          </p>
        </div>
      )}

      {s.asOf && <p className="mt-4 text-xs text-[var(--color-paper-faint)]">Ownership data as of {s.asOf}.</p>}
    </div>
  );
}

function Row({
  label,
  values,
  format,
  emphasis = false,
}: {
  label: string;
  values: (number | null)[];
  format: "currency" | "percent" | "number";
  emphasis?: boolean;
}) {
  return (
    <tr>
      <td className={cn("!text-left !font-sans", emphasis && "text-[var(--color-paper)]")}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={cn(emphasis && "text-[var(--color-paper)]")}>
          {format === "currency"
            ? formatIndianCurrency(v)
            : format === "percent"
              ? formatPercent(v, 1, false)
              : formatNumber(v, 2)}
        </td>
      ))}
    </tr>
  );
}
